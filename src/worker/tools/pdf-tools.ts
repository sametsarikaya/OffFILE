import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { OffscreenCanvasFactory } from '../utils';

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
  _fileMimes: string[],
  options: Record<string, unknown>,
  onProgress: ProgressFn,
): Promise<ProcessResult> {
  switch (toolId) {
    case 'merge-pdf':        return mergePdf(buffers, fileNames, options, onProgress);
    case 'split-pdf':        return splitPdf(buffers, fileNames, options, onProgress);
    case 'extract-pages-pdf':return extractPagesPdf(buffers, fileNames, options, onProgress);
    case 'remove-pdf-pages': return removePdfPages(buffers, fileNames, options, onProgress);
    case 'rotate-pdf':       return rotatePdf(buffers, fileNames, options, onProgress);
    case 'watermark-pdf':    return watermarkPdf(buffers, fileNames, options, onProgress);
    case 'page-numbers-pdf': return pageNumbersPdf(buffers, fileNames, options, onProgress);
    case 'compress-pdf':     return compressPdf(buffers, fileNames, options, onProgress);
    case 'pdf-metadata':     return pdfMetadata(buffers, fileNames, options, onProgress);
    case 'pdf-reorder-pages':return pdfReorderPages(buffers, fileNames, options, onProgress);
    case 'pdf-add-blank':    return pdfAddBlank(buffers, fileNames, options, onProgress);
    case 'pdf-resize-page':  return pdfResizePage(buffers, fileNames, options, onProgress);
    case 'pdf-unlock':       return pdfUnlock(buffers, fileNames, options, onProgress);
    default: throw new Error(`Unknown PDF tool: ${toolId}`);
  }
}

function parsePageRanges(input: string, total: number): number[] {
  const pages = new Set<number>();
  for (const part of String(input || '1').split(',')) {
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

async function splitPdf(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const src   = await PDFDocument.load(buffers[0]);
  const total = src.getPageCount();
  const rawPages = String(options.pages || '').trim();
  if (!rawPages) throw new Error('No pages selected. Click at least one page thumbnail to select it.');
  const pages = parsePageRanges(rawPages, total);
  const mode  = (options.mode as string) || 'combined';
  onProgress(20);

  if (pages.some((p) => p > total))
    throw new Error(`Page out of range - this PDF has ${total} page${total > 1 ? 's' : ''}.`);

  const base = fileNames[0].replace(/\.pdf$/i, '');

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
  const src   = await PDFDocument.load(buffers[0]);
  const total = src.getPageCount();
  const from  = Math.max(1, Number(options.from) || 1);
  const to    = Math.min(Number(options.to) || 3, total);
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
  const src   = await PDFDocument.load(buffers[0]);
  const total = src.getPageCount();
  onProgress(20);

  const input = String(options.pages || '1');
  const pagesToRemove = new Set<number>();
  for (const part of input.split(',')) {
    const t = part.trim();
    const range = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Math.max(1, parseInt(range[1]));
      const b = Math.min(total, parseInt(range[2]));
      for (let i = a; i <= b; i++) pagesToRemove.add(i);
    } else {
      const n = parseInt(t);
      if (!isNaN(n) && n >= 1 && n <= total) pagesToRemove.add(n);
    }
  }

  if (pagesToRemove.size === 0) throw new Error('No valid page numbers specified.');
  if (pagesToRemove.size >= total) throw new Error('Cannot remove all pages from a PDF.');

  const invalid = [...pagesToRemove].filter((p) => p > total);
  if (invalid.length > 0) throw new Error(`Page(s) ${invalid.join(', ')} don't exist. PDF has ${total} pages.`);

  onProgress(30);
  const out = await PDFDocument.create();
  const indices = Array.from({ length: total }, (_, i) => i).filter((i) => !pagesToRemove.has(i + 1));
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  onProgress(80);

  const bytes = await out.save();
  onProgress(100);
  const base  = fileNames[0].replace(/\.pdf$/i, '');
  const label = [...pagesToRemove].sort((a, b) => a - b).join('_');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_removed_p${label}.pdf`, mime: 'application/pdf' };
}

async function rotatePdf(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const angle = parseInt(options.angle as string) || 90;
  const doc   = await PDFDocument.load(buffers[0]);
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
    const page  = pages[i];
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
  const quality  = (options.quality as string) || 'medium';
  const scaleMap: Record<string, number> = { low: 0.8, medium: 1.2, high: 1.8 };
  const jpegQMap: Record<string, number> = { low: 0.45, medium: 0.65, high: 0.82 };
  const scale = scaleMap[quality] ?? 1.2;
  const jpegQ = jpegQMap[quality] ?? 0.65;
  onProgress(10);

  const pdfDoc     = await pdfjsLib.getDocument({ data: buffers[0], CanvasFactory: OffscreenCanvasFactory } as Parameters<typeof pdfjsLib.getDocument>[0]).promise;
  const totalPages = pdfDoc.numPages;
  const outDoc     = await PDFDocument.create();
  onProgress(15);

  for (let i = 1; i <= totalPages; i++) {
    const page     = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas   = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx      = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
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

async function pdfMetadata(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const mode = (options.mode as string) || 'edit';
  onProgress(20);
  const doc  = await PDFDocument.load(buffers[0]);
  onProgress(50);
  const base = fileNames[0].replace(/\.pdf$/i, '');

  if (mode === 'strip') {
    doc.setTitle(''); doc.setAuthor(''); doc.setSubject('');
    doc.setKeywords([]); doc.setCreator(''); doc.setProducer('');
    doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0));
    const bytes = await doc.save();
    onProgress(100);
    return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_clean.pdf`, mime: 'application/pdf' };
  }

  if (mode === 'edit') {
    if ('title'    in options) doc.setTitle(String(options.title    ?? ''));
    if ('author'   in options) doc.setAuthor(String(options.author   ?? ''));
    if ('subject'  in options) doc.setSubject(String(options.subject  ?? ''));
    if ('creator'  in options) doc.setCreator(String(options.creator  ?? ''));
    if ('producer' in options) doc.setProducer(String(options.producer ?? ''));
    if ('keywords' in options) {
      const kw = String(options.keywords ?? '');
      doc.setKeywords(kw ? kw.split(',').map((s) => s.trim()).filter(Boolean) : []);
    }
    const bytes = await doc.save();
    onProgress(100);
    return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_edited.pdf`, mime: 'application/pdf' };
  }

  // mode === 'view'
  const report = [
    '=== PDF Metadata Report ===',
    `File:    ${fileNames[0]}`,
    `Pages:   ${doc.getPageCount()}`,
    '', '--- Metadata Fields ---',
    `Title:   ${doc.getTitle()   || '(none)'}`,
    `Author:  ${doc.getAuthor()  || '(none)'}`,
    `Subject: ${doc.getSubject() || '(none)'}`,
    `Creator: ${doc.getCreator() || '(none)'}`,
  ].join('\n');
  onProgress(100);
  return { buffer: new TextEncoder().encode(report).buffer as ArrayBuffer, filename: `${base}_metadata.txt`, mime: 'text/plain' };
}

async function pdfReorderPages(
  buffers: ArrayBuffer[], fileNames: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const src   = await PDFDocument.load(buffers[0]);
  const total = src.getPageCount();
  onProgress(20);

  const orderStr = String(options.order || '').trim();
  if (!orderStr) throw new Error('Enter a page order, e.g. "3,1,2".');

  const indices = orderStr.split(',').map((s) => {
    const n = parseInt(s.trim(), 10);
    if (isNaN(n) || n < 1 || n > total)
      throw new Error(`Invalid page number "${s.trim()}". This PDF has ${total} pages.`);
    return n - 1;
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

  const pageSizes: Record<string, [number, number]> = {
    a4: [595.28, 841.89], letter: [612, 792],
  };

  let blankW: number, blankH: number;
  if (size === 'match') {
    const s = src.getPage(0).getSize();
    blankW = s.width; blankH = s.height;
  } else {
    [blankW, blankH] = pageSizes[size] ?? pageSizes.a4;
  }

  const allCopied = await out.copyPages(src, Array.from({ length: total }, (_, i) => i));
  const insertAt  =
    position === 'start' ? 0 :
    position === 'end'   ? total :
    Math.min(afterPage, total);

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

  const pageSizes: Record<string, [number, number]> = {
    a4: [595.28, 841.89], a3: [841.89, 1190.55], letter: [612, 792], legal: [612, 1008],
  };

  let [pw, ph] = pageSizes[targetSize] ?? pageSizes.a4;
  if (orientation === 'landscape') [pw, ph] = [ph, pw];

  const srcPdf   = await pdfjsLib.getDocument({ data: buffers[0], CanvasFactory: OffscreenCanvasFactory } as Parameters<typeof pdfjsLib.getDocument>[0]).promise;
  const totalPgs = srcPdf.numPages;
  const outDoc   = await PDFDocument.create();
  onProgress(15);

  for (let i = 1; i <= totalPgs; i++) {
    const page     = await srcPdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas   = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx      = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
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
    else                 { dh = ah; dw = ah * ratio; }
    outPage.drawImage(img, { x: margin + (aw - dw) / 2, y: margin + (ah - dh) / 2, width: dw, height: dh });
    onProgress(15 + (i / totalPgs) * 80);
  }

  const bytes = await outDoc.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_${targetSize}.pdf`, mime: 'application/pdf' };
}

async function pdfUnlock(
  buffers: ArrayBuffer[], fileNames: string[],
  _options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  onProgress(20);

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buffers[0], { ignoreEncryption: true });
  } catch {
    throw new Error('Could not open PDF. User-password encryption cannot be removed without the password.');
  }
  onProgress(70);

  const bytes = await doc.save();
  onProgress(100);
  const base = fileNames[0].replace(/\.pdf$/i, '');
  return { buffer: bytes.buffer as ArrayBuffer, filename: `${base}_unlocked.pdf`, mime: 'application/pdf' };
}
