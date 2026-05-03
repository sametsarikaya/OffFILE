import type { WorkerRequest, WorkerResponse } from '../types';

type ProgressCallback = (percent: number) => void;

interface PendingRequest {
  resolve: (value: { buffer: ArrayBuffer; filename: string; mime: string }) => void;
  reject:  (reason: Error) => void;
  onProgress: ProgressCallback;
}

const POOL_SIZE = 2;

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
    } else if (msg.type === 'result') {
      pending.delete(msg.id);
      req.resolve({ buffer: msg.buffer, filename: msg.filename, mime: msg.mime });
    } else if (msg.type === 'error') {
      pending.delete(msg.id);
      req.reject(new Error(msg.message));
    }
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

function dispatchToWorker(
  w: Worker,
  request: WorkerRequest,
  onProgress: ProgressCallback
): Promise<{ buffer: ArrayBuffer; filename: string; mime: string }> {
  const pending = pendingByWorker.get(w)!;
  return new Promise((resolve, reject) => {
    pending.set(request.id, { resolve, reject, onProgress });
    w.postMessage(request, request.buffers);
  });
}

export async function runTool(
  toolId: string,
  files: File[],
  options: Record<string, unknown>,
  onProgress: ProgressCallback
): Promise<{ blob: Blob; filename: string }> {
  const id      = String(++idCounter);
  const buffers = await Promise.all(files.map((f) => f.arrayBuffer()));
  const request: WorkerRequest = {
    id, toolId, buffers,
    fileNames: files.map((f) => f.name),
    fileMimes: files.map((f) => f.type),
    options,
  };
  const result = await dispatchToWorker(getWorker(0), request, onProgress);
  return { blob: new Blob([result.buffer], { type: result.mime }), filename: result.filename };
}

export async function runToolBatch(
  toolId: string,
  files: File[],
  options: Record<string, unknown>,
  onProgress: ProgressCallback
): Promise<{ blob: Blob; filename: string }[]> {
  const total = files.length;
  if (total === 0) return [];

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

  const groupResults = await Promise.all(
    groups.map(async (entries, wi) => {
      const results: { idx: number; blob: Blob; filename: string }[] = [];
      for (const { idx, file } of entries) {
        wp[wi].current = 0;
        const buf = await file.arrayBuffer();
        const req: WorkerRequest = {
          id:        String(++idCounter),
          toolId,
          buffers:   [buf],
          fileNames: [file.name],
          fileMimes: [file.type],
          options,
        };
        const result = await dispatchToWorker(getWorker(wi), req, (pct) => {
          wp[wi].current = pct;
          aggregateProgress();
        });
        wp[wi].done++;
        wp[wi].current = 0;
        aggregateProgress();
        results.push({ idx, blob: new Blob([result.buffer], { type: result.mime }), filename: result.filename });
      }
      return results;
    })
  );

  // Flatten and sort by original index to restore input order
  const flat = groupResults.flat().sort((a, b) => a.idx - b.idx);
  onProgress(100);
  return flat.map(({ blob, filename }) => ({ blob, filename }));
}
