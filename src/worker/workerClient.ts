import type { WorkerRequest, WorkerResponse } from '../types';

type ProgressCallback = (percent: number) => void;

interface PendingRequest {
  resolve: (value: { buffer: ArrayBuffer; filename: string; mime: string }) => void;
  reject:  (reason: Error) => void;
  onProgress: ProgressCallback;
}

let worker: Worker | null = null;
const pending = new Map<string, PendingRequest>();
let idCounter = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./offfile.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
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

    worker.onerror = (e) => {
      const message = e.message ?? 'Worker crashed unexpectedly.';
      pending.forEach((req) => req.reject(new Error(message)));
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

/**
 * Terminate the current worker and reject all pending requests.
 * Call this when the user cancels an in-progress operation.
 */
export function cancelCurrentTool(): void {
  if (!worker) return;
  worker.terminate();
  worker = null;
  pending.forEach((req) => req.reject(new Error('Cancelled')));
  pending.clear();
}

/**
 * Run a tool in the Web Worker.
 * Returns a Blob once complete. Progress is reported via onProgress (0-100).
 */
export async function runTool(
  toolId: string,
  files: File[],
  options: Record<string, unknown>,
  onProgress: ProgressCallback
): Promise<{ blob: Blob; filename: string }> {
  const id = String(++idCounter);

  const buffers   = await Promise.all(files.map((f) => f.arrayBuffer()));
  const fileNames = files.map((f) => f.name);
  const fileMimes = files.map((f) => f.type);

  const request: WorkerRequest = { id, toolId, buffers, fileNames, fileMimes, options };

  const w = getWorker();

  const result = await new Promise<{ buffer: ArrayBuffer; filename: string; mime: string }>(
    (resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress });
      w.postMessage(request, buffers);
    }
  );

  const blob = new Blob([result.buffer], { type: result.mime });
  return { blob, filename: result.filename };
}

/**
 * Run a tool on each file individually (batch mode).
 * Calls onProgress with overall 0-100 progress.
 * Returns an array of results in the same order as files.
 */
export async function runToolBatch(
  toolId: string,
  files: File[],
  options: Record<string, unknown>,
  onProgress: ProgressCallback
): Promise<{ blob: Blob; filename: string }[]> {
  const results: { blob: Blob; filename: string }[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const result = await runTool(toolId, [files[i]], options, (pct) => {
      onProgress(((i + pct / 100) / total) * 100);
    });
    results.push(result);
    onProgress(((i + 1) / total) * 100);
  }

  return results;
}
