import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { OffscreenCanvasFactory, loadBitmap } from '../utils';
import { generateQR } from './qr-generator';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

type ProgressFn = (p: number) => void;
interface ProcessResult { buffer: ArrayBuffer; filename: string; mime: string; }

export async function dispatch(
  toolId: string,
  buffers: ArrayBuffer[],
  fileNames: string[],
  fileMimes: string[],
  options: Record<string, unknown>,
  onProgress: ProgressFn,
): Promise<ProcessResult> {
  switch (toolId) {
    case 'pdf-to-image':   return pdfToImage(buffers, fileNames, options, onProgress);
    case 'pdf-to-text':    return pdfToText(buffers, fileNames, options, onProgress);
    case 'image-to-pdf':   return imageToPdf(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-to-base64':return imageToBase64(buffers, fileNames, fileMimes, options, onProgress);
    case 'svg-to-png':     return svgToPng(buffers, fileNames, fileMimes, options, onProgress);
    case 'create-zip':     return createZip(buffers, fileNames, options, onProgress);
    case 'extract-zip':    return extractZip(buffers, fileNames, onProgress);
    case 'qr-code':        return qrCode(options, onProgress);
    default: throw new Error(`Unknown convert tool: ${toolId}`);
  }
}

function parsePageRanges(input: string, total: number): number[] {
  const pages = new Set<number>();
  for (const part of String(input || '').split(',')) {
    const t = part.trim();
    const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, parseInt(m[1]));
      const b = Math.min(total, parseInt(m[2]));
      for (let i = a; i <= b; i++) pages.add(i);
    } else {
      const n = parseInt(t);
      if (!isNaN(n) && n >= 1 && n <= total) pages.add(n);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

async function pdfToImage(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const format  = (options.format as string) || 'image/png';
  const ext     = format === 'image/jpeg' ? 'jpg' : 'png';
  const quality = format === 'image/jpeg' ? 0.92 : 1;
  const SCALE   = 1.5;

  onProgress(5);
  const pdfDoc     = await pdfjsLib.getDocument({ data: buffers[0], CanvasFactory: OffscreenCanvasFactory } as Parameters<typeof pdfjsLib.getDocument>[0]).promise;
  const totalPages = pdfDoc.numPages;
  const base       = fileNames[0].replace(/\.pdf$/i, '');

  const rawPages = String(options.pages || '').trim();
  const pagesToRender = rawPages
    ? parsePageRanges(rawPages, totalPages)
    : Array.from({ length: totalPages }, (_, i) => i + 1);

  if (pagesToRender.length === 0) throw new Error('No pages selected.');

  const renderPage = async (pageNum: number) => {
    const page     = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas   = new OffscreenCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx      = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
    const blob   = await canvas.convertToBlob({ type: format, quality });
    const buffer = await blob.arrayBuffer();
    const suffix = pagesToRender.length > 1 ? `_page${pageNum}` : '';
    return { buffer, filename: `${base}${suffix}.${ext}` };
  };

  if (pagesToRender.length === 1) {
    const result = await renderPage(pagesToRender[0]);
    onProgress(100);
    return { buffer: result.buffer, filename: result.filename, mime: format };
  }

  const zip = new JSZip();
  for (let i = 0; i < pagesToRender.length; i++) {
    const result = await renderPage(pagesToRender[i]);
    zip.file(result.filename, result.buffer);
    onProgress(5 + ((i + 1) / pagesToRender.length) * 90);
  }
  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  onProgress(100);
  return { buffer: zipBuffer, filename: `${base}_pages.zip`, mime: 'application/zip' };
}

async function pdfToText(
  buffers: ArrayBuffer[], fileNames: string[],
  _options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  onProgress(10);
  const pdfDoc     = await pdfjsLib.getDocument({ data: buffers[0], CanvasFactory: OffscreenCanvasFactory } as Parameters<typeof pdfjsLib.getDocument>[0]).promise;
  const totalPages = pdfDoc.numPages;
  const lines: string[] = [`PDF Text Extraction - ${fileNames[0]}`, ''];
  for (let i = 1; i <= totalPages; i++) {
    const page    = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
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

async function imageToPdf(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const pageSize = (options.pageSize as string) || 'a4';
  const pageSizes: Record<string, [number, number]> = {
    a4: [595.28, 841.89], letter: [612, 792],
  };
  const doc = await PDFDocument.create();
  for (let i = 0; i < buffers.length; i++) {
    const mime   = fileMimes[i] || 'image/jpeg';
    const bitmap = await loadBitmap(buffers[i], mime);
    const iw = bitmap.width, ih = bitmap.height;
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
      const aw = pw - margin * 2, ah = ph - margin * 2;
      const ratio = iw / ih;
      let dw: number, dh: number;
      if (ratio > aw / ah) { dw = aw; dh = aw / ratio; } else { dh = ah; dw = ah * ratio; }
      page.drawImage(img, { x: margin + (aw - dw) / 2, y: margin + (ah - dh) / 2, width: dw, height: dh });
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
  for (let i = 0; i < uint8.length; i += chunk)
    binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
  const b64 = btoa(binary);
  onProgress(75);
  const output =
    format === 'css' ? `background-image: url("data:${mimeType};base64,${b64}");` :
    format === 'raw' ? b64 :
    `data:${mimeType};base64,${b64}`;
  const buffer = new TextEncoder().encode(output).buffer as ArrayBuffer;
  onProgress(100);
  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_base64.txt`, mime: 'text/plain' };
}

async function svgToPng(
  buffers: ArrayBuffer[], fileNames: string[], _fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const format = (options.format as string) || 'image/png';
  const scale  = Math.max(1, Math.min(4, Number(options.scale) || 2));
  onProgress(20);

  const svgText = new TextDecoder().decode(buffers[0]);
  const blob    = new Blob([svgText], { type: 'image/svg+xml' });

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error('Failed to load SVG. Ensure it has valid width/height attributes and is well-formed XML.');
  }

  if (bitmap.width === 0 || bitmap.height === 0) {
    bitmap.close();
    throw new Error('SVG has no intrinsic dimensions. Add width and height attributes to the <svg> root element.');
  }

  onProgress(50);
  const w = Math.round(bitmap.width  * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx    = canvas.getContext('2d')!;

  if (format === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  onProgress(80);

  const quality = format === 'image/png' ? 1 : 0.92;
  const ext     = format === 'image/jpeg' ? 'jpg' : 'png';
  const outBlob = await canvas.convertToBlob({ type: format, quality });
  const buffer  = await outBlob.arrayBuffer();
  onProgress(100);

  const base = fileNames[0].replace(/\.svg$/i, '');
  return { buffer, filename: `${base}@${scale}x.${ext}`, mime: format };
}

async function createZip(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const compression = Math.max(0, Math.min(9, Number(options.compression ?? 6)));
  const zip = new JSZip();

  for (let i = 0; i < buffers.length; i++) {
    zip.file(fileNames[i], buffers[i], { compression: compression > 0 ? 'DEFLATE' : 'STORE', compressionOptions: { level: compression } });
    onProgress(((i + 1) / buffers.length) * 70);
  }

  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' }, (meta) => {
    onProgress(70 + meta.percent * 0.3);
  });
  onProgress(100);
  return { buffer: zipBuffer, filename: 'archive.zip', mime: 'application/zip' };
}

async function extractZip(
  buffers: ArrayBuffer[], fileNames: string[],
  onProgress: ProgressFn
): Promise<ProcessResult> {
  onProgress(10);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffers[0]);
  } catch {
    throw new Error('Not a valid ZIP file.');
  }
  onProgress(30);

  const entries = Object.entries(zip.files).filter(([, e]) => !e.dir);
  if (entries.length === 0) throw new Error('ZIP archive is empty.');

  // Single file → return directly; multiple → re-zip for individual download buttons in UI
  if (entries.length === 1) {
    const [name, entry] = entries[0];
    const buffer = await entry.async('arraybuffer');
    onProgress(100);
    return { buffer, filename: name, mime: 'application/octet-stream' };
  }

  // Return the original ZIP — the router's extractZipEntries will show individual download buttons
  onProgress(100);
  return { buffer: buffers[0], filename: fileNames[0], mime: 'application/zip' };
}

async function qrCode(
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const text       = String(options.text ?? '').trim();
  const outputSize = Math.max(128, Math.min(2048, Number(options.size) || 512));
  const ecLevel    = (options.errorLevel as 'L' | 'M' | 'Q' | 'H') || 'M';
  const darkColor  = String(options.darkColor  || '#000000');
  const lightColor = String(options.lightColor || '#ffffff');

  if (!text) throw new Error('Enter text or a URL to generate a QR code.');
  onProgress(10);

  const matrix   = generateQR(text, ecLevel);
  const modules  = matrix.length;
  onProgress(40);

  // Draw QR on OffscreenCanvas with quiet zone (4 modules on each side)
  const quiet    = 4;
  const totalMod = modules + quiet * 2;
  const cellPx   = Math.max(1, Math.floor(outputSize / totalMod));
  const canvasSize = totalMod * cellPx;

  const canvas = new OffscreenCanvas(canvasSize, canvasSize);
  const ctx    = canvas.getContext('2d')!;

  ctx.fillStyle = lightColor;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = darkColor;

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (matrix[r][c]) {
        ctx.fillRect((quiet + c) * cellPx, (quiet + r) * cellPx, cellPx, cellPx);
      }
    }
  }
  onProgress(80);

  const blob   = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await blob.arrayBuffer();
  onProgress(100);

  const safeName = text.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_');
  return { buffer, filename: `qr_${safeName}.png`, mime: 'image/png' };
}
