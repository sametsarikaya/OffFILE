import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { z } from 'zod';
import type { WorkerRequest, WorkerResponse } from '../types';

const SplitPdfOptions = z.object({
  pages: z.string().optional().default('1'),
  mode: z.enum(['combined', 'individual']).optional().default('combined'),
});

const ImageCollageOptions = z.object({
  columns: z.coerce.number().int().min(1).max(8).default(2),
  gap: z.coerce.number().int().min(0).max(64).default(8),
  cellSize: z.coerce.number().int().min(64).max(1200).default(400),
  background: z.string().default('#ffffff'),
  fitMode: z.enum(['cover', 'contain']).default('cover'),
});

const optionSchemas: Record<string, z.ZodTypeAny> = {
  'split-pdf':     SplitPdfOptions,
  'image-collage': ImageCollageOptions,
};

function parseOptions(toolId: string, raw: Record<string, unknown>): Record<string, unknown> {
  const schema = optionSchemas[toolId];
  if (!schema) return raw;
  const result = schema.safeParse(raw);
  if (!result.success) {
    const msgs = result.error.issues.map((i: z.ZodIssue) => i.message).join('; ');
    throw new Error(`Invalid options for ${toolId}: ${msgs}`);
  }
  return result.data as Record<string, unknown>;
}

// Configure pdfjs to use its own bundled worker (local, no CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

/* ---- Message handler ---- */

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, toolId, buffers, fileNames, fileMimes, options } = e.data;

  const progress = (percent: number) =>
    (self as unknown as Worker).postMessage({ type: 'progress', id, percent } satisfies WorkerResponse);

  try {
    const result = await dispatch(toolId, buffers, fileNames, fileMimes, options, progress);
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

/* ---- Dispatch ---- */

async function dispatch(
  toolId: string,
  buffers: ArrayBuffer[],
  fileNames: string[],
  fileMimes: string[],
  options: Record<string, unknown>,
  onProgress: ProgressFn
): Promise<ProcessResult> {
  const opts = parseOptions(toolId, options);
  switch (toolId) {
    case 'merge-pdf':        return mergePdf(buffers, fileNames, opts, onProgress);
    case 'split-pdf':        return splitPdf(buffers, fileNames, opts, onProgress);
    case 'extract-pages-pdf':return extractPagesPdf(buffers, fileNames, opts, onProgress);
    case 'remove-pdf-pages': return removePdfPages(buffers, fileNames, opts, onProgress);
    case 'rotate-pdf':       return rotatePdf(buffers, fileNames, opts, onProgress);
    case 'watermark-pdf':    return watermarkPdf(buffers, fileNames, opts, onProgress);
    case 'page-numbers-pdf': return pageNumbersPdf(buffers, fileNames, opts, onProgress);
    case 'compress-pdf':     return compressPdf(buffers, fileNames, opts, onProgress);
    case 'pdf-to-image':     return pdfToImage(buffers, fileNames, opts, onProgress);
    case 'pdf-metadata':     return pdfMetadata(buffers, fileNames, opts, onProgress);
    case 'image-convert':    return imageConvert(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-compress':   return imageCompress(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-resize':     return imageResize(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-rotate':     return imageRotate(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-flip':       return imageFlip(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-watermark':  return imageWatermark(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-filters':    return imageFilters(buffers, fileNames, fileMimes, opts, onProgress);
    case 'strip-metadata':   return stripMetadata(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-to-pdf':     return imageToPdf(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-to-base64':  return imageToBase64(buffers, fileNames, fileMimes, opts, onProgress);
    case 'color-palette':    return colorPalette(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-crop':        return imageCrop(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-collage':     return imageCollage(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-add-bg':      return imageAddBg(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-merge':       return imageMerge(buffers, fileNames, fileMimes, opts, onProgress);
    case 'image-grayscale':   return imageGrayscale(buffers, fileNames, fileMimes, opts, onProgress);
    case 'pdf-to-text':       return pdfToText(buffers, fileNames, opts, onProgress);
    case 'pdf-reorder-pages': return pdfReorderPages(buffers, fileNames, opts, onProgress);
    case 'pdf-add-blank':     return pdfAddBlank(buffers, fileNames, opts, onProgress);
    case 'pdf-resize-page':   return pdfResizePage(buffers, fileNames, opts, onProgress);
    default:
      throw new Error(`Unknown tool: ${toolId}`);
  }
}

async function mergePdf(
  buffers: ArrayBuffer[], fileNames: string[],
  _options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const merged = await PDFDocument.create();
  for (let i = 0; i < buffers.length; i++) {
    const doc = await PDFDocument.load(buffers[i]);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
    onProgress(((i + 1) / buffers.length) * 90);
  }
  const bytes = await merged.save();
  onProgress(100);
  return { buffer: bytes.buffer as ArrayBuffer, filename: 'merged.pdf', mime: 'application/pdf' };
}

function parsePageRanges(input: string, total: number): number[] {
  const pages = new Set<number>();
  const parts = String(input || '1').split(',');
  for (const part of parts) {
    const t = part.trim();
    const rangeMatch = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const a = Math.max(1, parseInt(rangeMatch[1]));
      const b = Math.min(total, parseInt(rangeMatch[2]));
      for (let i = a; i <= b; i++) pages.add(i);
    } else {
      const n = parseInt(t);
      if (!isNaN(n) && n >= 1 && n <= total) pages.add(n);
    }
  }
  const result = [...pages].sort((a, b) => a - b);
  return result.length > 0 ? result : [1];
}

async function splitPdf(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const src   = await PDFDocument.load(buffers[0]);
  const total = src.getPageCount();
  const pages = parsePageRanges(String(options.pages || '1'), total);
  const mode  = (options.mode as string) || 'combined';
  onProgress(20);

  if (pages.some((p) => p > total)) {
    throw new Error(`Page out of range - this PDF has ${total} page${total > 1 ? 's' : ''}.`);
  }

  const base = fileNames[0].replace(/\.pdf$/i, '');

  // Individual mode: one PDF per page bundled in a ZIP
  if (mode === 'individual' && pages.length > 1) {
    const zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
      const pageDoc = await PDFDocument.create();
      const [copied] = await pageDoc.copyPages(src, [pages[i] - 1]);
      pageDoc.addPage(copied);
      const bytes = await pageDoc.save();
      zip.file(`${base}_page${pages[i]}.pdf`, bytes);
      onProgress(20 + ((i + 1) / pages.length) * 70);
    }
    const zipBytes = await zip.generateAsync({ type: 'arraybuffer' });
    onProgress(100);
    return { buffer: zipBytes, filename: `${base}_pages.zip`, mime: 'application/zip' };
  }

  // Combined mode (default): all selected pages in one PDF
  const out    = await PDFDocument.create();
  const copied = await out.copyPages(src, pages.map((p) => p - 1));
  copied.forEach((p) => out.addPage(p));
  onProgress(80);

  const bytes = await out.save();
  onProgress(100);
  const label = pages.length === 1 ? `_page${pages[0]}` : `_pages${pages[0]}-${pages[pages.length - 1]}`;
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}${label}.pdf`, mime: 'application/pdf' };
}

async function extractPagesPdf(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const src = await PDFDocument.load(buffers[0]);
  const total = src.getPageCount();
  const from = Math.max(1, Number(options.from) || 1);
  const to   = Math.min(Number(options.to) || 3, total);
  onProgress(30);

  if (from > total) throw new Error(`Start page ${from} exceeds total pages (${total}).`);
  if (from > to)    throw new Error('"From" page must be ≤ "To" page.');

  const out = await PDFDocument.create();
  const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  onProgress(80);

  const bytes = await out.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_pages${from}-${to}.pdf`, mime: 'application/pdf' };
}

async function removePdfPages(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const src = await PDFDocument.load(buffers[0]);
  const total = src.getPageCount();
  const pageToRemove = Math.max(1, Number(options.pages) || 1);
  onProgress(30);

  if (pageToRemove > total) throw new Error(`Page ${pageToRemove} doesn't exist. PDF has ${total} pages.`);
  if (total <= 1)           throw new Error('Cannot remove the only page from a PDF.');

  const out = await PDFDocument.create();
  const indices = Array.from({ length: total }, (_, i) => i).filter((i) => i !== pageToRemove - 1);
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  onProgress(80);

  const bytes = await out.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_removed_p${pageToRemove}.pdf`, mime: 'application/pdf' };
}

async function rotatePdf(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const angle = parseInt(options.angle as string) || 90;
  const doc = await PDFDocument.load(buffers[0]);
  onProgress(30);

  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    pages[i].setRotation(degrees(pages[i].getRotation().angle + angle));
    onProgress(30 + (i / pages.length) * 60);
  }

  const bytes = await doc.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_rotated.pdf`, mime: 'application/pdf' };
}

async function watermarkPdf(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const text    = (options.text as string) || 'CONFIDENTIAL';
  const opacity = (Number(options.opacity) || 15) / 100;
  onProgress(20);

  const doc  = await PDFDocument.load(buffers[0]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  onProgress(40);

  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const fontSize  = Math.min(width, height) / (text.length * 0.7);
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    page.drawText(text, {
      x: (width - textWidth * 0.7) / 2,
      y: (height - fontSize) / 2,
      size: fontSize, font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: degrees(-45),
    });
    onProgress(40 + (i / pages.length) * 50);
  }

  const bytes = await doc.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_watermarked.pdf`, mime: 'application/pdf' };
}

async function pageNumbersPdf(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const position = (options.position as string) || 'center';
  const format   = (options.format   as string) || 'number';
  onProgress(20);

  const doc  = await PDFDocument.load(buffers[0]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  onProgress(40);

  const pages    = doc.getPages();
  const total    = pages.length;
  const fontSize = 10;
  const margin   = 30;

  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const { width } = page.getSize();
    const label =
      format === 'of'   ? `${i + 1} of ${total}` :
      format === 'dash' ? `- ${i + 1} -` : `${i + 1}`;

    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const x =
      position === 'center' ? (width - textWidth) / 2 :
      position === 'right'  ? width - textWidth - margin : margin;

    page.drawText(label, { x, y: margin - 10, size: fontSize, font, color: rgb(0.4, 0.4, 0.4) });
    onProgress(40 + (i / total) * 50);
  }

  const bytes = await doc.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_numbered.pdf`, mime: 'application/pdf' };
}

async function compressPdf(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const quality = (options.quality as string) || 'medium';
  const scaleMap:   Record<string, number> = { low: 0.8, medium: 1.2, high: 1.8 };
  const jpegQMap:   Record<string, number> = { low: 0.45, medium: 0.65, high: 0.82 };
  const scale = scaleMap[quality] ?? 1.2;
  const jpegQ = jpegQMap[quality] ?? 0.65;
  onProgress(10);

  const pdfDoc = await pdfjsLib.getDocument({ data: buffers[0] }).promise;
  const totalPages = pdfDoc.numPages;
  onProgress(15);

  const outDoc = await PDFDocument.create();

  for (let i = 1; i <= totalPages; i++) {
    const page     = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas   = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx      = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    // pdfjs v4 types require HTMLCanvasElement; OffscreenCanvas is compatible at runtime
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: jpegQ });
    const jpegBuf  = await jpegBlob.arrayBuffer();
    const img      = await outDoc.embedJpg(jpegBuf);

    const wPt = viewport.width  * (72 / 96);
    const hPt = viewport.height * (72 / 96);
    const p   = outDoc.addPage([wPt, hPt]);
    p.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
    onProgress(15 + (i / totalPages) * 80);
  }

  const bytes = await outDoc.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_compressed.pdf`, mime: 'application/pdf' };
}

async function pdfToImage(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const format   = (options.format as string) || 'image/png';
  const scale    = parseFloat(options.scale  as string) || 2;
  onProgress(10);

  const pdfDoc    = await pdfjsLib.getDocument({ data: buffers[0] }).promise;
  const totalPages = pdfDoc.numPages;
  const pageNum   = Math.max(1, Math.min(totalPages, Number(options.page) || 1));

  if (pageNum > totalPages) {
    throw new Error(`Page ${pageNum} doesn't exist - this PDF has ${totalPages} page${totalPages > 1 ? 's' : ''}.`);
  }

  const page     = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  onProgress(40);

  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx    = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;
  onProgress(85);

  const quality = format === 'image/jpeg' ? 0.92 : 1;
  const blob    = await canvas.convertToBlob({ type: format, quality });
  const buffer  = await blob.arrayBuffer();
  onProgress(100);

  const ext  = format === 'image/jpeg' ? 'jpg' : 'png';
  const base = fileNames[0].replace(/\.pdf$/i, '');
  const suffix = totalPages > 1 ? `_page${pageNum}` : '';
  return { buffer, filename: `${base}${suffix}.${ext}`, mime: format };
}

async function pdfMetadata(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const mode = (options.mode as string) || 'view';
  onProgress(20);

  const doc = await PDFDocument.load(buffers[0]);
  onProgress(50);

  const title   = doc.getTitle()   || '(none)';
  const author  = doc.getAuthor()  || '(none)';
  const subject = doc.getSubject() || '(none)';
  const creator = doc.getCreator() || '(none)';
  const pages   = doc.getPageCount();

  if (mode === 'strip') {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setCreator('OffFILE');
    doc.setProducer('OffFILE');
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    onProgress(80);

    const bytes = await doc.save();
    onProgress(100);
    const base = fileNames[0].replace(/\.pdf$/i, '');
    return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_clean.pdf`, mime: 'application/pdf' };
  }

  // mode === 'view': return a metadata report as plain text
  const report = [
    '=== PDF Metadata Report ===',
    `File:    ${fileNames[0]}`,
    `Pages:   ${pages}`,
    '',
    '--- Metadata Fields ---',
    `Title:   ${title}`,
    `Author:  ${author}`,
    `Subject: ${subject}`,
    `Creator: ${creator}`,
    '',
    'To remove this metadata, re-run with "Strip & clean metadata" selected.',
  ].join('\n');

  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return {
    buffer: new TextEncoder().encode(report).buffer as ArrayBuffer,
    filename: `${base}_metadata.txt`,
    mime: 'text/plain',
  };
}


async function loadBitmap(buffer: ArrayBuffer, mime: string): Promise<ImageBitmap> {
  const blob = new Blob([buffer], { type: mime || 'image/png' });
  return createImageBitmap(blob);
}

async function bitmapToBuffer(
  bitmap: ImageBitmap, mime: string, quality = 0.92
): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx    = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: mime, quality });
  return blob.arrayBuffer();
}

function outMime(fileMime: string, forced?: string): string {
  if (forced) return forced;
  return fileMime === 'image/png' ? 'image/png' : 'image/jpeg';
}

function outExt(mime: string): string {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
}

async function imageConvert(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const format  = (options.format as string) || 'image/png';
  const srcMime = fileMimes[0] || 'image/png';
  onProgress(20);

  const bitmap = await loadBitmap(buffers[0], srcMime);
  onProgress(60);

  // Guard: SVG may render as 0×0 when there are no intrinsic dimensions
  if (bitmap.width === 0 || bitmap.height === 0) {
    bitmap.close();
    throw new Error(
      'SVG has no intrinsic dimensions (missing width/height attributes). ' +
      'Add width and height to the SVG root element and try again.'
    );
  }

  const quality = format === 'image/png' ? 1 : 0.92;
  const buffer  = await bitmapToBuffer(bitmap, format, quality);
  bitmap.close();
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}.${outExt(format)}`, mime: format };
}

async function imageCompress(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const quality = ((options.quality as number) || 70) / 100;
  const format  = (options.format  as string)  || 'image/jpeg';
  onProgress(20);

  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  onProgress(60);

  const buffer = await bitmapToBuffer(bitmap, format, quality);
  bitmap.close();
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_compressed.${outExt(format)}`, mime: format };
}

async function imageResize(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const targetW   = Math.max(1, (options.width  as number) || 800);
  const keepRatio = options.keepRatio !== false; // default true
  onProgress(20);

  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  onProgress(50);

  const targetH = keepRatio
    ? Math.max(1, Math.round(targetW * (bitmap.height / bitmap.width)))
    : Math.max(1, (options.height as number) || 600);

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx    = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();
  onProgress(80);

  const mime   = outMime(fileMimes[0]);
  const blob   = await canvas.convertToBlob({ type: mime, quality: 0.92 });
  const buffer = await blob.arrayBuffer();
  onProgress(100);

  const ext  = mime === 'image/png' ? 'png' : 'jpg';
  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_${targetW}x${targetH}.${ext}`, mime };
}

async function imageRotate(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const angle = parseInt(options.angle as string) || 90;
  onProgress(20);

  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  onProgress(40);

  const rad = (angle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w   = Math.round(bitmap.width * cos + bitmap.height * sin);
  const h   = Math.round(bitmap.width * sin + bitmap.height * cos);

  const canvas = new OffscreenCanvas(w, h);
  const ctx    = canvas.getContext('2d')!;
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  onProgress(80);

  const mime   = outMime(fileMimes[0]);
  const blob   = await canvas.convertToBlob({ type: mime, quality: 0.92 });
  const buffer = await blob.arrayBuffer();
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_rotated${angle}.${outExt(mime)}`, mime };
}

async function imageFlip(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const direction = (options.direction as string) || 'horizontal';
  onProgress(20);

  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  onProgress(40);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx    = canvas.getContext('2d')!;

  ctx.save();
  if (direction === 'horizontal' || direction === 'both') { ctx.translate(bitmap.width, 0);  ctx.scale(-1,  1); }
  if (direction === 'vertical'   || direction === 'both') { ctx.translate(0, bitmap.height); ctx.scale( 1, -1); }
  ctx.drawImage(bitmap, 0, 0);
  ctx.restore();
  bitmap.close();
  onProgress(80);

  const mime   = outMime(fileMimes[0]);
  const blob   = await canvas.convertToBlob({ type: mime, quality: 0.92 });
  const buffer = await blob.arrayBuffer();
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_flipped.${outExt(mime)}`, mime };
}

async function imageWatermark(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const text    = ((options.text as string) || 'CONFIDENTIAL').trim() || 'CONFIDENTIAL';
  const opacity = (Number(options.opacity) || 30) / 100;
  const color   = (options.color as string) || '#888888';
  onProgress(20);

  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  onProgress(40);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx    = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const fontSize = Math.max(20, Math.min(bitmap.width, bitmap.height) / 12);
  const spacing  = fontSize * 5;

  ctx.save();
  ctx.globalAlpha  = opacity;
  ctx.fillStyle    = color;
  ctx.font         = `bold ${fontSize}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 4);

  for (let y = -canvas.height; y < canvas.height * 2; y += spacing) {
    for (let x = -canvas.width; x < canvas.width * 2; x += spacing) {
      ctx.fillText(text, x - canvas.width / 2, y - canvas.height / 2);
    }
  }
  ctx.restore();
  onProgress(80);

  const mime   = outMime(fileMimes[0]);
  const blob   = await canvas.convertToBlob({ type: mime, quality: 0.92 });
  const buffer = await blob.arrayBuffer();
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  const ext  = fileNames[0].split('.').pop() || outExt(mime);
  return { buffer, filename: `${base}_watermarked.${ext}`, mime };
}

async function imageFilters(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const filter    = (options.filter    as string) || 'grayscale';
  const intensity = Math.max(0, Math.min(100, Number(options.intensity ?? 100))) / 100;
  onProgress(20);

  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  onProgress(40);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx    = canvas.getContext('2d')!;

  // Build CSS filter string scaled by intensity
  const pct = Math.round(intensity * 100);
  const filterMap: Record<string, string> = {
    grayscale:  `grayscale(${pct}%)`,
    sepia:      `sepia(${pct}%)`,
    invert:     `invert(${pct}%)`,
    brightness: `brightness(${100 + Math.round(30 * intensity)}%)`,
    contrast:   `contrast(${100 + Math.round(50 * intensity)}%)`,
    blur:       `blur(${(3 * intensity).toFixed(1)}px)`,
    saturate:   `saturate(${100 + Math.round(200 * intensity)}%)`,
  };

  (ctx as unknown as { filter: string }).filter = filterMap[filter] || 'none';
  ctx.drawImage(bitmap, 0, 0);
  (ctx as unknown as { filter: string }).filter = 'none';
  bitmap.close();
  onProgress(80);

  const mime   = outMime(fileMimes[0]);
  const blob   = await canvas.convertToBlob({ type: mime, quality: 0.92 });
  const buffer = await blob.arrayBuffer();
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_${filter}.${outExt(mime)}`, mime };
}

async function stripMetadata(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  _options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  onProgress(20);
  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  onProgress(50);

  const buffer = await bitmapToBuffer(bitmap, outMime(fileMimes[0]), 0.95);
  bitmap.close();
  onProgress(100);

  const mime = outMime(fileMimes[0]);
  const base = fileNames[0].replace(/\.[^.]+$/, '');
  const ext  = fileNames[0].split('.').pop() || outExt(mime);
  return { buffer, filename: `${base}_clean.${ext}`, mime };
}

async function imageToPdf(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const pageSize = (options.pageSize as string) || 'a4';
  const pageSizes: Record<string, [number, number]> = {
    a4:     [595.28, 841.89],
    letter: [612, 792],
  };

  const doc = await PDFDocument.create();

  for (let i = 0; i < buffers.length; i++) {
    const mime   = fileMimes[i] || 'image/jpeg';
    const bitmap = await loadBitmap(buffers[i], mime);
    const iw     = bitmap.width;
    const ih     = bitmap.height;

    // Embed as PNG to preserve quality (convert via OffscreenCanvas)
    const canvas = new OffscreenCanvas(iw, ih);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    const pngBuf  = await pngBlob.arrayBuffer();
    const img     = await doc.embedPng(pngBuf);

    let page;
    if (pageSize === 'fit') {
      page = doc.addPage([iw, ih]);
      page.drawImage(img, { x: 0, y: 0, width: iw, height: ih });
    } else {
      const [pw, ph] = pageSizes[pageSize] ?? pageSizes.a4;
      page = doc.addPage([pw, ph]);
      const margin = 28;
      const aw = pw - margin * 2;
      const ah = ph - margin * 2;
      const ratio = iw / ih;
      let dw: number, dh: number;
      if (ratio > aw / ah) { dw = aw; dh = aw / ratio; }
      else                 { dh = ah; dw = ah * ratio; }
      page.drawImage(img, {
        x: margin + (aw - dw) / 2,
        y: margin + (ah - dh) / 2,
        width: dw, height: dh,
      });
    }

    onProgress(((i + 1) / buffers.length) * 95);
  }

  const bytes = await doc.save();
  onProgress(100);
  return { buffer: bytes.buffer as ArrayBuffer, filename: 'images.pdf', mime: 'application/pdf' };
}

async function imageToBase64(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const format   = (options.format as string) || 'dataurl';
  const mimeType = fileMimes[0] || 'image/png';
  onProgress(20);

  const uint8 = new Uint8Array(buffers[0]);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < uint8.length; i += chunk) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  onProgress(75);

  const output =
    format === 'css'     ? `background-image: url("data:${mimeType};base64,${b64}");` :
    format === 'raw'     ? b64 :
    /* dataurl */          `data:${mimeType};base64,${b64}`;

  const buffer = new TextEncoder().encode(output).buffer as ArrayBuffer;
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_base64.txt`, mime: 'text/plain' };
}

async function colorPalette(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const numColors = parseInt(options.colors as string) || 8;
  onProgress(20);

  const bitmap    = await loadBitmap(buffers[0], fileMimes[0]);
  const sampleSize = 150;
  const canvas    = new OffscreenCanvas(sampleSize, sampleSize);
  const ctx       = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, sampleSize, sampleSize);
  bitmap.close();
  onProgress(40);

  const data   = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  const palette = medianCut(pixels, numColors);
  onProgress(75);

  // Return JSON so the UI can render interactive swatches with copy buttons
  const colors = palette.map((c) => ({
    hex: rgbToHex(c),
    r: c[0], g: c[1], b: c[2],
  }));

  const json   = JSON.stringify({ source: fileNames[0], colors });
  const buffer = new TextEncoder().encode(json).buffer as ArrayBuffer;
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_palette.json`, mime: 'application/json' };
}

async function imageCrop(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const xPct = Math.max(0,  Math.min(80,  Number(options.x) || 10));
  const yPct = Math.max(0,  Math.min(80,  Number(options.y) || 10));
  const wPct = Math.max(10, Math.min(100, Number(options.w) || 80));
  const hPct = Math.max(10, Math.min(100, Number(options.h) || 80));
  onProgress(20);

  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  const sw     = bitmap.width;
  const sh     = bitmap.height;

  const sx = Math.round(sw * xPct / 100);
  const sy = Math.round(sh * yPct / 100);
  const cw = Math.round(sw * wPct / 100);
  const ch = Math.round(sh * hPct / 100);

  // Clamp to image bounds
  const actualW = Math.min(cw, sw - sx);
  const actualH = Math.min(ch, sh - sy);
  if (actualW <= 0 || actualH <= 0) throw new Error('Crop area is outside the image bounds.');
  onProgress(50);

  const canvas = new OffscreenCanvas(actualW, actualH);
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, actualW, actualH, 0, 0, actualW, actualH);
  bitmap.close();
  onProgress(80);

  const mime   = outMime(fileMimes[0]);
  const blob   = await canvas.convertToBlob({ type: mime, quality: 0.95 });
  const buffer = await blob.arrayBuffer();
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_cropped.${outExt(mime)}`, mime };
}

async function imageCollage(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const columns    = Math.max(1, Math.min(8, Number(options.columns) || 2));
  const gap        = Math.max(0, Math.min(64, Number(options.gap) || 8));
  const cellSize   = Math.max(64, Math.min(1200, Number(options.cellSize) || 400));
  const background = String(options.background || '#ffffff');
  // 'cover' = fill cell (crop to fit), 'contain' = fit inside cell (letterbox)
  const fitMode    = (options.fitMode as string) || 'cover';

  const rows      = Math.ceil(buffers.length / columns);
  const cols      = Math.min(columns, buffers.length);
  const canvasW   = cols * cellSize + (cols - 1) * gap;
  const canvasH   = rows * cellSize + (rows - 1) * gap;

  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext('2d')!;

  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  for (let i = 0; i < buffers.length; i++) {
    const bitmap = await loadBitmap(buffers[i], fileMimes[i] || 'image/jpeg');
    const col    = i % cols;
    const row    = Math.floor(i / cols);
    const x      = col * (cellSize + gap);
    const y      = row * (cellSize + gap);

    let dw: number, dh: number, dx: number, dy: number;

    if (fitMode === 'contain') {
      // Fit: scale down to fit entirely within cell, letterbox
      const scale = Math.min(cellSize / bitmap.width, cellSize / bitmap.height);
      dw = bitmap.width * scale;
      dh = bitmap.height * scale;
      dx = x + (cellSize - dw) / 2;
      dy = y + (cellSize - dh) / 2;
      ctx.drawImage(bitmap, dx, dy, dw, dh);
    } else {
      // Cover: scale up to fill entire cell, clip overflow
      const scale = Math.max(cellSize / bitmap.width, cellSize / bitmap.height);
      dw = bitmap.width * scale;
      dh = bitmap.height * scale;
      dx = x + (cellSize - dw) / 2;
      dy = y + (cellSize - dh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellSize, cellSize);
      ctx.clip();
      ctx.drawImage(bitmap, dx, dy, dw, dh);
      ctx.restore();
    }

    bitmap.close();
    onProgress(((i + 1) / buffers.length) * 90);
  }

  const blob   = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await blob.arrayBuffer();
  onProgress(100);
  return { buffer, filename: 'collage.png', mime: 'image/png' };
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function medianCut(pixels: [number, number, number][], n: number): [number, number, number][] {
  if (!pixels.length) return [];
  let buckets: [number, number, number][][] = [pixels];

  while (buckets.length < n) {
    let maxRange = 0, splitIdx = 0, splitCh = 0;
    buckets.forEach((bucket, bi) => {
      [0, 1, 2].forEach((ch) => {
        let min = 255, max = 0;
        for (const p of bucket) {
          if (p[ch] < min) min = p[ch];
          if (p[ch] > max) max = p[ch];
        }
        const range = max - min;
        if (range > maxRange) { maxRange = range; splitIdx = bi; splitCh = ch; }
      });
    });

    const toSplit = buckets[splitIdx];
    toSplit.sort((a, b) => a[splitCh] - b[splitCh]);
    const mid = Math.floor(toSplit.length / 2);
    buckets.splice(splitIdx, 1, toSplit.slice(0, mid), toSplit.slice(mid));
    if (!buckets[buckets.length - 1].length) break;
  }

  return buckets.map((b) => {
    const avg = (ch: number) => Math.round(b.reduce((s, p) => s + p[ch], 0) / b.length);
    return [avg(0), avg(1), avg(2)] as [number, number, number];
  });
}

async function imageAddBg(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const color = (options.color as string) || '#ffffff';
  onProgress(20);

  const bitmap = await loadBitmap(buffers[0], fileMimes[0] || 'image/png');
  onProgress(50);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx    = canvas.getContext('2d')!;

  // Draw solid background first, then image on top
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  onProgress(80);

  const blob   = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await blob.arrayBuffer();
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_bg.png`, mime: 'image/png' };
}

async function imageMerge(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  if (buffers.length < 2) throw new Error('Select at least 2 images to merge.');

  const direction  = (options.direction  as string) || 'horizontal';
  const align      = (options.align      as string) || 'center';
  const gap        = Math.max(0, Number(options.gap) || 0);
  const background = (options.background as string) || '#ffffff';
  const isHoriz    = direction === 'horizontal';
  onProgress(10);

  const bitmaps = await Promise.all(
    buffers.map((buf, i) => loadBitmap(buf, fileMimes[i] || 'image/jpeg'))
  );
  onProgress(50);

  const maxCross = isHoriz
    ? Math.max(...bitmaps.map((b) => b.height))
    : Math.max(...bitmaps.map((b) => b.width));

  const totalMain = bitmaps.reduce(
    (sum, b) => sum + (isHoriz ? b.width : b.height), 0
  ) + gap * (bitmaps.length - 1);

  const canvasW = isHoriz ? totalMain : maxCross;
  const canvasH = isHoriz ? maxCross  : totalMain;

  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext('2d')!;

  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  let cursor = 0;
  for (const bm of bitmaps) {
    let x = 0, y = 0;
    if (isHoriz) {
      x = cursor;
      y = align === 'start' ? 0 : align === 'end' ? maxCross - bm.height : (maxCross - bm.height) / 2;
    } else {
      x = align === 'start' ? 0 : align === 'end' ? maxCross - bm.width : (maxCross - bm.width) / 2;
      y = cursor;
    }
    ctx.drawImage(bm, x, y);
    cursor += (isHoriz ? bm.width : bm.height) + gap;
    bm.close();
  }
  onProgress(90);

  const blob   = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await blob.arrayBuffer();
  onProgress(100);
  return { buffer, filename: 'merged.png', mime: 'image/png' };
}

async function imageGrayscale(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  _options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  onProgress(20);
  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  onProgress(40);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx    = canvas.getContext('2d')!;

  // CSS filter is the fastest path in OffscreenCanvas
  (ctx as unknown as { filter: string }).filter = 'grayscale(100%)';
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  onProgress(80);

  const mime   = outMime(fileMimes[0]);
  const blob   = await canvas.convertToBlob({ type: mime, quality: 0.95 });
  const buffer = await blob.arrayBuffer();
  onProgress(100);

  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_gray.${outExt(mime)}`, mime };
}

async function pdfToText(
  buffers: ArrayBuffer[], fileNames: string[],
  _options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  onProgress(10);
  const pdfDoc     = await pdfjsLib.getDocument({ data: buffers[0] }).promise;
  const totalPages = pdfDoc.numPages;
  const lines: string[] = [`PDF Text Extraction - ${fileNames[0]}`, ''];

  for (let i = 1; i <= totalPages; i++) {
    const page    = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      // pdfjs text items have a `str` field
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    lines.push(`--- Page ${i} ---`);
    if (pageText) lines.push(pageText);
    lines.push('');
    onProgress(10 + (i / totalPages) * 85);
  }

  const buffer = new TextEncoder().encode(lines.join('\n')).buffer as ArrayBuffer;
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer, filename: `${base}_text.txt`, mime: 'text/plain' };
}

async function pdfReorderPages(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const src    = await PDFDocument.load(buffers[0]);
  const total  = src.getPageCount();
  onProgress(20);

  const orderStr = String(options.order || '').trim();
  if (!orderStr) throw new Error('Enter a page order, e.g. "3,1,2".');

  const indices = orderStr.split(',').map((s) => {
    const n = parseInt(s.trim(), 10);
    if (isNaN(n) || n < 1 || n > total) {
      throw new Error(`Invalid page number "${s.trim()}". This PDF has ${total} pages.`);
    }
    return n - 1; // pdf-lib uses 0-based indices
  });

  const out    = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  onProgress(80);

  const bytes = await out.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_reordered.pdf`, mime: 'application/pdf' };
}

async function pdfAddBlank(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const position  = (options.position as string) || 'end';
  const afterPage = Math.max(1, Number(options.afterPage) || 1);
  const size      = (options.size as string) || 'match';
  onProgress(20);

  const src   = await PDFDocument.load(buffers[0]);
  const total = src.getPageCount();
  const out   = await PDFDocument.create();

  // Standard page sizes in PDF points (1 pt = 1/72 inch)
  const pageSizes: Record<string, [number, number]> = {
    a4:     [595.28, 841.89],
    letter: [612, 792],
  };

  // Determine blank page dimensions
  let blankW: number, blankH: number;
  if (size === 'match') {
    const firstPage = src.getPage(0);
    const s = firstPage.getSize();
    blankW = s.width;
    blankH = s.height;
  } else {
    [blankW, blankH] = pageSizes[size] ?? pageSizes.a4;
  }

  const allIndices = Array.from({ length: total }, (_, i) => i);
  const allCopied  = await out.copyPages(src, allIndices);

  // Insert position: 0-based index where blank goes
  const insertAt =
    position === 'start' ? 0 :
    position === 'end'   ? total :
    Math.min(afterPage, total); // 'after' N → insert at index N

  for (let i = 0; i < allCopied.length; i++) {
    if (i === insertAt) out.addPage([blankW, blankH]);
    out.addPage(allCopied[i]);
  }
  if (insertAt >= allCopied.length) out.addPage([blankW, blankH]);
  onProgress(80);

  const bytes = await out.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_blank_added.pdf`, mime: 'application/pdf' };
}

async function pdfResizePage(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const targetSize  = (options.size        as string) || 'a4';
  const orientation = (options.orientation as string) || 'portrait';
  onProgress(10);

  // Page sizes in PDF points
  const pageSizes: Record<string, [number, number]> = {
    a4:     [595.28, 841.89],
    a3:     [841.89, 1190.55],
    letter: [612, 792],
    legal:  [612, 1008],
  };

  let [pw, ph] = pageSizes[targetSize] ?? pageSizes.a4;
  if (orientation === 'landscape') [pw, ph] = [ph, pw];

  const srcPdf    = await pdfjsLib.getDocument({ data: buffers[0] }).promise;
  const totalPgs  = srcPdf.numPages;
  const outDoc    = await PDFDocument.create();
  onProgress(15);

  for (let i = 1; i <= totalPgs; i++) {
    const page     = await srcPdf.getPage(i);
    // Render at 1.5× for decent quality
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas   = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx      = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    const pngBuf  = await pngBlob.arrayBuffer();
    const img     = await outDoc.embedPng(pngBuf);

    const outPage = outDoc.addPage([pw, ph]);
    const margin  = 28;
    const aw = pw - margin * 2;
    const ah = ph - margin * 2;
    const { width: iw, height: ih } = img.size();
    const ratio = iw / ih;
    let dw: number, dh: number;
    if (ratio > aw / ah) { dw = aw; dh = aw / ratio; }
    else                 { dh = ah; dw = ah * ratio;  }

    outPage.drawImage(img, {
      x: margin + (aw - dw) / 2,
      y: margin + (ah - dh) / 2,
      width: dw, height: dh,
    });

    onProgress(15 + (i / totalPgs) * 80);
  }

  const bytes = await outDoc.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_${targetSize}.pdf`, mime: 'application/pdf' };
}

