import { z } from 'zod';
import type { WorkerRequest, WorkerResponse } from '../types';

/* ---- Tool routing sets ---- */

const PDF_TOOLS = new Set([
  'merge-pdf', 'split-pdf', 'extract-pages-pdf', 'remove-pdf-pages',
  'rotate-pdf', 'watermark-pdf', 'page-numbers-pdf', 'compress-pdf',
  'pdf-metadata', 'pdf-reorder-pages', 'pdf-add-blank', 'pdf-resize-page',
  'pdf-unlock',
]);

const IMAGE_TOOLS = new Set([
  'image-convert', 'image-compress', 'image-resize', 'image-rotate',
  'image-flip', 'image-watermark', 'image-filters', 'strip-metadata',
  'image-grayscale', 'image-add-bg', 'image-merge', 'image-crop',
  'image-collage', 'color-palette',
]);

const CONVERT_TOOLS = new Set([
  'pdf-to-image', 'pdf-to-text', 'image-to-pdf', 'image-to-base64',
  'svg-to-png', 'create-zip', 'extract-zip', 'qr-code',
]);

/* ---- Zod option schemas ---- */

const pages  = z.string().optional().default('');
const color  = z.string().optional().default('#000000');
const angle  = z.coerce.number().multipleOf(90).optional().default(90);

const schemas: Record<string, z.ZodTypeAny> = {
  /* PDF */
  'split-pdf': z.object({
    pages: z.string().optional().default('1'),
    mode:  z.enum(['combined', 'individual']).optional().default('combined'),
  }),
  'extract-pages-pdf': z.object({ pages }),
  'remove-pdf-pages':  z.object({ pages }),
  'rotate-pdf': z.object({
    angle,
    pages: z.string().optional().default(''),
  }),
  'watermark-pdf': z.object({
    text:     z.string().optional().default('CONFIDENTIAL'),
    opacity:  z.coerce.number().min(0.05).max(1).optional().default(0.3),
    fontSize: z.coerce.number().min(8).max(200).optional().default(48),
    color:    color,
  }),
  'page-numbers-pdf': z.object({
    position: z.enum(['bottom-center', 'bottom-right', 'top-center', 'top-right']).optional().default('bottom-center'),
    fontSize: z.coerce.number().min(6).max(72).optional().default(10),
    startAt:  z.coerce.number().int().min(1).optional().default(1),
  }),
  'compress-pdf': z.object({
    quality: z.enum(['screen', 'ebook', 'printer', 'prepress']).optional().default('ebook'),
  }),
  'pdf-metadata': z.object({
    title:   z.string().optional().default(''),
    author:  z.string().optional().default(''),
    subject: z.string().optional().default(''),
    creator: z.string().optional().default(''),
  }),
  'pdf-reorder-pages': z.object({
    order: z.string().optional().default(''),
  }),
  'pdf-add-blank': z.object({
    count:    z.coerce.number().int().min(1).max(100).optional().default(1),
    position: z.enum(['end', 'after-each']).optional().default('end'),
  }),
  'pdf-resize-page': z.object({
    preset: z.enum(['a4', 'letter', 'a3', 'custom']).optional().default('a4'),
    width:  z.coerce.number().min(1).optional().default(595),
    height: z.coerce.number().min(1).optional().default(842),
  }),
  'pdf-unlock': z.object({}),

  /* Image */
  'image-convert': z.object({
    format: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional().default('image/jpeg'),
  }),
  'image-compress': z.object({
    quality: z.coerce.number().min(0.1).max(1).optional().default(0.8),
    format:  z.enum(['image/jpeg', 'image/png', 'image/webp']).optional().default('image/jpeg'),
  }),
  'image-resize': z.object({
    width:  z.coerce.number().int().min(1).max(16000).optional().default(800),
    height: z.coerce.number().int().min(1).max(16000).optional().default(600),
    mode:   z.enum(['stretch', 'contain', 'cover']).optional().default('contain'),
  }),
  'image-rotate': z.object({ angle }),
  'image-flip': z.object({
    direction: z.enum(['horizontal', 'vertical']).optional().default('horizontal'),
  }),
  'image-watermark': z.object({
    text:     z.string().optional().default('Watermark'),
    position: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).optional().default('center'),
    opacity:  z.coerce.number().min(0.05).max(1).optional().default(0.5),
    fontSize: z.coerce.number().min(8).max(200).optional().default(36),
    color:    color,
  }),
  'image-filters': z.object({
    filter:    z.string().optional().default('blur'),
    intensity: z.coerce.number().min(0).max(100).optional().default(50),
  }),
  'image-add-bg': z.object({
    color: z.string().optional().default('#ffffff'),
  }),
  'image-merge': z.object({
    direction: z.enum(['horizontal', 'vertical']).optional().default('horizontal'),
    gap:       z.coerce.number().int().min(0).max(200).optional().default(0),
  }),
  'image-crop': z.object({
    x:      z.coerce.number().min(0).optional().default(0),
    y:      z.coerce.number().min(0).optional().default(0),
    width:  z.coerce.number().min(1).optional().default(100),
    height: z.coerce.number().min(1).optional().default(100),
  }),
  'image-collage': z.object({
    columns:  z.coerce.number().int().min(1).max(8).default(2),
    gap:      z.coerce.number().int().min(0).max(64).default(8),
    cellSize: z.coerce.number().int().min(64).max(1200).default(400),
    background: z.string().default('#ffffff'),
    fitMode:  z.enum(['cover', 'contain']).default('cover'),
  }),
  'color-palette': z.object({
    count: z.coerce.number().int().min(2).max(32).optional().default(8),
  }),

  /* Convert */
  'pdf-to-image': z.object({
    format: z.enum(['image/png', 'image/jpeg']).optional().default('image/png'),
    pages:  z.string().optional().default(''),
  }),
  'image-to-pdf': z.object({
    pageSize: z.enum(['a4', 'letter', 'fit']).optional().default('a4'),
  }),
  'image-to-base64': z.object({
    format: z.enum(['dataurl', 'raw', 'css']).optional().default('dataurl'),
  }),
  'svg-to-png': z.object({
    format: z.enum(['image/png', 'image/jpeg']).optional().default('image/png'),
    scale:  z.coerce.number().min(1).max(4).optional().default(2),
  }),
  'create-zip': z.object({
    compression: z.coerce.number().int().min(0).max(9).optional().default(6),
  }),
  'qr-code': z.object({
    text:        z.string().optional().default(''),
    size:        z.coerce.number().int().min(128).max(2048).optional().default(512),
    errorLevel:  z.enum(['L', 'M', 'Q', 'H']).optional().default('M'),
    darkColor:   z.string().optional().default('#000000'),
    lightColor:  z.string().optional().default('#ffffff'),
  }),
};

function parseOptions(toolId: string, raw: Record<string, unknown>): Record<string, unknown> {
  const schema = schemas[toolId];
  if (!schema) return raw;
  const result = schema.safeParse(raw);
  if (!result.success) {
    const msgs = result.error.issues.map((i: z.ZodIssue) => i.message).join('; ');
    throw new Error(`Invalid options for ${toolId}: ${msgs}`);
  }
  return result.data as Record<string, unknown>;
}

/* ---- Message handler ---- */

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, toolId, buffers, fileNames, fileMimes, options } = e.data;

  const progress = (percent: number) =>
    (self as unknown as Worker).postMessage({ type: 'progress', id, percent } satisfies WorkerResponse);

  try {
    const opts   = parseOptions(toolId, options);
    const result = await dispatch(toolId, buffers, fileNames, fileMimes, opts, progress);
    (self as unknown as Worker).postMessage(
      { type: 'result', id, buffer: result.buffer, filename: result.filename, mime: result.mime } satisfies WorkerResponse,
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

interface ProcessResult { buffer: ArrayBuffer; filename: string; mime: string; }
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
