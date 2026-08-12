import type { WorkerRequest, WorkerResponse } from '../types';
import { getToolById } from '../tools/registry';
import { validateToolOptions } from '../tools/optionsSchema';
import { readResult, deleteResult } from './opfs';

type ProgressCallback = (percent: number) => void;

/** What a finished job hands back, ready to download. */
export interface ToolOutput {
  blob: Blob;
  filename: string;
  /**
   * Frees the backing store, once the blob is no longer needed. An OPFS-backed
   * result is a handle to a file on disk: delete it while a download is still
   * pointing at it and the download fails.
   */
  release?: () => void;
}

interface PendingRequest {
  resolve: (value: ToolOutput) => void;
  reject: (reason: Error) => void;
  onProgress: ProgressCallback;
}

/**
 * Batch jobs are spread across this many workers.
 *
 * Each one can hold a whole PDF or decoded bitmap in memory, so this trades
 * throughput against peak memory rather than chasing core count: one core is
 * left for the UI thread, and the ceiling keeps a 16-core desktop from opening
 * sixteen copies of pdf.js. A machine that does not report its core count gets
 * the old fixed pair.
 */
const MAX_POOL_SIZE = 4;
const FALLBACK_POOL_SIZE = 2;

const POOL_SIZE = computePoolSize();

function computePoolSize(): number {
  const cores = navigator.hardwareConcurrency;
  if (!cores || !Number.isFinite(cores)) return FALLBACK_POOL_SIZE;
  return Math.max(1, Math.min(cores - 1, MAX_POOL_SIZE));
}

const pool: Worker[] = [];
const pendingByWorker = new Map<Worker, Map<string, PendingRequest>>();
let idCounter = 0;

function spawnWorker(): Worker {
  const w = new Worker(new URL('./offfile.worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<string, PendingRequest>();
  pendingByWorker.set(w, pending);

  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const req = pending.get(msg.id);
    if (!req) return;
    if (msg.type === 'progress') {
      req.onProgress(msg.percent);
      return;
    }

    pending.delete(msg.id);

    if (msg.type === 'result') {
      req.resolve({ blob: new Blob([msg.buffer], { type: msg.mime }), filename: msg.filename });
      return;
    }

    if (msg.type === 'result-file') {
      void resolveFromOpfs(msg, req);
      return;
    }

    req.reject(new Error(msg.message));
  };

  w.onerror = (e) => {
    const message = e.message ?? 'Worker crashed unexpectedly.';
    pending.forEach((req) => req.reject(new Error(message)));
    pending.clear();
    const idx = pool.indexOf(w);
    if (idx !== -1) pool.splice(idx, 1);
    pendingByWorker.delete(w);
  };

  return w;
}

function getWorker(index: number): Worker {
  while (pool.length <= index) pool.push(spawnWorker());
  return pool[index];
}

export function cancelCurrentTool(): void {
  for (const w of pool) {
    w.terminate();
    pendingByWorker.get(w)?.forEach((req) => req.reject(new Error('Cancelled')));
  }
  pool.length = 0;
  pendingByWorker.clear();
}

/**
 * Turns an OPFS-backed result into a File the browser can stream from disk,
 * and drops the entry so results do not accumulate. If reading it back fails,
 * the job fails rather than silently handing back nothing.
 */
async function resolveFromOpfs(
  msg: Extract<WorkerResponse, { type: 'result-file' }>,
  req: PendingRequest
): Promise<void> {
  const file = await readResult(msg.name, msg.mime);
  if (!file) {
    req.reject(new Error('The result could not be read back from browser storage.'));
    return;
  }

  req.resolve({
    blob: file,
    filename: msg.filename,
    release: () => void deleteResult(msg.name),
  });
}

function dispatchToWorker(
  w: Worker,
  request: WorkerRequest,
  onProgress: ProgressCallback
): Promise<ToolOutput> {
  const pending = pendingByWorker.get(w)!;
  return new Promise((resolve, reject) => {
    pending.set(request.id, { resolve, reject, onProgress });
    // Files are structured-cloned by reference; nothing is copied here.
    w.postMessage(request);
  });
}

/**
 * Validates options against the schema derived from the tool's own declaration,
 * so what the UI offers and what the worker receives can never disagree.
 */
function checkedOptions(toolId: string, options: Record<string, unknown>): Record<string, unknown> {
  const tool = getToolById(toolId);
  if (!tool) return options;

  const result = validateToolOptions(tool, options);
  if (!result.ok) throw new Error(result.error);
  return result.options;
}

export async function runTool(
  toolId: string,
  files: File[],
  options: Record<string, unknown>,
  onProgress: ProgressCallback
): Promise<ToolOutput> {
  const request: WorkerRequest = {
    id: String(++idCounter),
    toolId,
    files,
    options: checkedOptions(toolId, options),
  };
  return dispatchToWorker(getWorker(0), request, onProgress);
}

export async function runToolBatch(
  toolId: string,
  files: File[],
  options: Record<string, unknown>,
  onProgress: ProgressCallback,
  onFileProgress?: (done: number, total: number) => void
): Promise<ToolOutput[]> {
  const total = files.length;
  if (total === 0) return [];

  const validated = checkedOptions(toolId, options);

  // Distribute files round-robin across pool workers
  const workerCount = Math.min(POOL_SIZE, total);
  // groups[wi] = list of (originalIndex, file) pairs for worker wi
  const groups: { idx: number; file: File }[][] = Array.from({ length: workerCount }, () => []);
  files.forEach((file, i) => groups[i % workerCount].push({ idx: i, file }));

  // Track per-worker: how many files done + current file's progress
  const wp = Array.from({ length: workerCount }, () => ({ done: 0, current: 0 }));

  function aggregateProgress(): void {
    let completed = 0;
    for (const s of wp) completed += s.done + s.current / 100;
    onProgress((completed / total) * 100);
  }

  let totalFilesCompleted = 0;

  const groupResults = await Promise.all(
    groups.map(async (entries, wi) => {
      const results: { idx: number; blob: Blob; filename: string; release?: () => void }[] = [];
      for (const { idx, file } of entries) {
        wp[wi].current = 0;
        const req: WorkerRequest = {
          id: String(++idCounter),
          toolId,
          files: [file],
          options: validated,
        };
        const result = await dispatchToWorker(getWorker(wi), req, (pct) => {
          wp[wi].current = pct;
          aggregateProgress();
        });
        wp[wi].done++;
        wp[wi].current = 0;
        totalFilesCompleted++;
        aggregateProgress();
        onFileProgress?.(totalFilesCompleted, total);
        results.push({
          idx,
          blob: result.blob,
          filename: result.filename,
          release: result.release,
        });
      }
      return results;
    })
  );

  // Flatten and sort by original index to restore input order
  const flat = groupResults.flat().sort((a, b) => a.idx - b.idx);
  onProgress(100);
  return flat.map(({ blob, filename, release }) => ({ blob, filename, release }));
}
