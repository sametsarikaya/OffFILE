import type { WorkerRequest, WorkerResponse } from '../types';

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

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, toolId, buffers, fileNames, fileMimes, options } = e.data;

  const progress = (percent: number) =>
    (self as unknown as Worker).postMessage({
      type: 'progress',
      id,
      percent,
    } satisfies WorkerResponse);

  try {
    const result = await dispatch(toolId, buffers, fileNames, fileMimes, options, progress);
    (self as unknown as Worker).postMessage(
      {
        type: 'result',
        id,
        buffer: result.buffer,
        filename: result.filename,
        mime: result.mime,
      } satisfies WorkerResponse,
      [result.buffer]
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : 'Processing failed.',
    } satisfies WorkerResponse);
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
