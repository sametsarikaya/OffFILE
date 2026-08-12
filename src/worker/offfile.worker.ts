import type { WorkerRequest, WorkerResponse } from '../types';
import { writeResult, resultName } from './opfs';

/* ---- Tool routing sets ---- */

const PDF_TOOLS = new Set([
  'merge-pdf',
  'split-pdf',
  'extract-pages-pdf',
  'remove-pdf-pages',
  'rotate-pdf',
  'watermark-pdf',
  'page-numbers-pdf',
  'compress-pdf',
  'pdf-metadata',
  'pdf-reorder-pages',
  'pdf-add-blank',
  'pdf-resize-page',
  'pdf-unlock',
]);

const IMAGE_TOOLS = new Set([
  'image-convert',
  'image-compress',
  'image-resize',
  'image-rotate',
  'image-flip',
  'image-watermark',
  'image-filters',
  'strip-metadata',
  'image-grayscale',
  'image-add-bg',
  'image-merge',
  'image-crop',
  'image-collage',
  'color-palette',
]);

const CONVERT_TOOLS = new Set([
  'pdf-to-image',
  'pdf-to-text',
  'image-to-pdf',
  'image-to-base64',
  'svg-to-png',
  'create-zip',
  'extract-zip',
  'qr-code',
  'file-hash',
  'text-to-pdf',
  'favicon-generator',
]);

/* ---- Message handler ---- */

const post = (message: WorkerResponse, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(message, transfer ?? []);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, toolId, files, options } = e.data;

  const progress = (percent: number) => post({ type: 'progress', id, percent });

  try {
    // Reading here rather than on the main thread keeps the bytes in one place.
    const buffers = await Promise.all(files.map((file) => file.arrayBuffer()));
    const fileNames = files.map((file) => file.name);
    const fileMimes = files.map((file) => file.type);

    const result = await dispatch(toolId, buffers, fileNames, fileMimes, options, progress);

    const name = await writeResult(resultName(id, result.filename), result.buffer);
    if (name) {
      post({ type: 'result-file', id, name, filename: result.filename, mime: result.mime });
      return;
    }

    post(
      { type: 'result', id, buffer: result.buffer, filename: result.filename, mime: result.mime },
      [result.buffer]
    );
  } catch (err) {
    post({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : 'Processing failed.',
    });
  }
};

interface ProcessResult {
  buffer: ArrayBuffer;
  filename: string;
  mime: string;
}
type ProgressFn = (p: number) => void;

/* ---- Lazy-loaded dispatch ---- */

async function dispatch(
  toolId: string,
  buffers: ArrayBuffer[],
  fileNames: string[],
  fileMimes: string[],
  options: Record<string, unknown>,
  onProgress: ProgressFn
): Promise<ProcessResult> {
  if (PDF_TOOLS.has(toolId)) {
    const mod = await import('./tools/pdf-tools');
    return mod.dispatch(toolId, buffers, fileNames, fileMimes, options, onProgress);
  }
  if (IMAGE_TOOLS.has(toolId)) {
    const mod = await import('./tools/image-tools');
    return mod.dispatch(toolId, buffers, fileNames, fileMimes, options, onProgress);
  }
  if (CONVERT_TOOLS.has(toolId)) {
    const mod = await import('./tools/convert-tools');
    return mod.dispatch(toolId, buffers, fileNames, fileMimes, options, onProgress);
  }
  throw new Error(`Unknown tool: ${toolId}`);
}
