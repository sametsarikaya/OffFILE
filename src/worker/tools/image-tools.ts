import { loadBitmap, bitmapToBuffer, outMime, outExt } from '../utils';

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
    case 'image-convert':  return imageConvert(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-compress': return imageCompress(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-resize':   return imageResize(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-rotate':   return imageRotate(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-flip':     return imageFlip(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-watermark':return imageWatermark(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-filters':  return imageFilters(buffers, fileNames, fileMimes, options, onProgress);
    case 'strip-metadata': return stripMetadata(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-grayscale':return imageGrayscale(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-add-bg':   return imageAddBg(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-merge':    return imageMerge(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-crop':     return imageCrop(buffers, fileNames, fileMimes, options, onProgress);
    case 'image-collage':  return imageCollage(buffers, fileNames, fileMimes, options, onProgress);
    case 'color-palette':  return colorPalette(buffers, fileNames, fileMimes, options, onProgress);
    default: throw new Error(`Unknown image tool: ${toolId}`);
  }
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
  if (bitmap.width === 0 || bitmap.height === 0) {
    bitmap.close();
    throw new Error('SVG has no intrinsic dimensions (missing width/height attributes). Add width and height to the SVG root element and try again.');
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
  const keepRatio = options.keepRatio !== false;
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
  const ext  = outExt(mime);
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
  for (let y = -canvas.height; y < canvas.height * 2; y += spacing)
    for (let x = -canvas.width; x < canvas.width * 2; x += spacing)
      ctx.fillText(text, x - canvas.width / 2, y - canvas.height / 2);
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

function applyBoxBlur(imageData: ImageData, w: number, h: number, radius: number): void {
  const src  = new Uint8ClampedArray(imageData.data);
  const dst  = imageData.data;
  const r    = Math.min(radius, Math.floor(Math.min(w, h) / 2) - 1);
  const tmp  = new Uint8ClampedArray(dst.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rr = 0, gg = 0, bb = 0, cnt = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = Math.min(w - 1, Math.max(0, x + dx));
        const idx = (y * w + nx) * 4;
        rr += src[idx]; gg += src[idx + 1]; bb += src[idx + 2]; cnt++;
      }
      const oi = (y * w + x) * 4;
      tmp[oi] = rr/cnt; tmp[oi+1] = gg/cnt; tmp[oi+2] = bb/cnt; tmp[oi+3] = src[oi+3];
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let rr = 0, gg = 0, bb = 0, cnt = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = Math.min(h - 1, Math.max(0, y + dy));
        const idx = (ny * w + x) * 4;
        rr += tmp[idx]; gg += tmp[idx+1]; bb += tmp[idx+2]; cnt++;
      }
      const oi = (y * w + x) * 4;
      dst[oi] = rr/cnt; dst[oi+1] = gg/cnt; dst[oi+2] = bb/cnt; dst[oi+3] = tmp[oi+3];
    }
  }
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
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (filter === 'grayscale') {
      const luma = Math.round(0.299*r + 0.587*g + 0.114*b);
      const m = (v: number) => Math.round(v + (luma - v) * intensity);
      data[i] = m(r); data[i+1] = m(g); data[i+2] = m(b);
    } else if (filter === 'sepia') {
      const sr = Math.min(255, Math.round(r*0.393+g*0.769+b*0.189));
      const sg = Math.min(255, Math.round(r*0.349+g*0.686+b*0.168));
      const sb = Math.min(255, Math.round(r*0.272+g*0.534+b*0.131));
      data[i]   = Math.round(r+(sr-r)*intensity);
      data[i+1] = Math.round(g+(sg-g)*intensity);
      data[i+2] = Math.round(b+(sb-b)*intensity);
    } else if (filter === 'invert') {
      data[i]   = Math.round(r+(255-r-r)*intensity);
      data[i+1] = Math.round(g+(255-g-g)*intensity);
      data[i+2] = Math.round(b+(255-b-b)*intensity);
    } else if (filter === 'brightness') {
      const delta = Math.round(80*intensity);
      data[i] = Math.min(255, r+delta); data[i+1] = Math.min(255, g+delta); data[i+2] = Math.min(255, b+delta);
    } else if (filter === 'contrast') {
      const factor = 1 + intensity*1.5;
      data[i]   = Math.min(255, Math.max(0, Math.round((r-128)*factor+128)));
      data[i+1] = Math.min(255, Math.max(0, Math.round((g-128)*factor+128)));
      data[i+2] = Math.min(255, Math.max(0, Math.round((b-128)*factor+128)));
    } else if (filter === 'saturate') {
      const luma = 0.299*r + 0.587*g + 0.114*b;
      const sat  = 1 + 2*intensity;
      data[i]   = Math.min(255, Math.max(0, Math.round(luma+(r-luma)*sat)));
      data[i+1] = Math.min(255, Math.max(0, Math.round(luma+(g-luma)*sat)));
      data[i+2] = Math.min(255, Math.max(0, Math.round(luma+(b-luma)*sat)));
    }
  }
  if (filter === 'blur') applyBoxBlur(imageData, canvas.width, canvas.height, Math.max(1, Math.round(12*intensity)));
  ctx.putImageData(imageData, 0, 0);
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

async function imageGrayscale(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  _options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  onProgress(20);
  const bitmap = await loadBitmap(buffers[0], fileMimes[0]);
  onProgress(40);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx    = canvas.getContext('2d')!;
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
  const bitmaps = await Promise.all(buffers.map((buf, i) => loadBitmap(buf, fileMimes[i] || 'image/jpeg')));
  onProgress(50);
  const maxCross = isHoriz ? Math.max(...bitmaps.map((b) => b.height)) : Math.max(...bitmaps.map((b) => b.width));
  const totalMain = bitmaps.reduce((sum, b) => sum + (isHoriz ? b.width : b.height), 0) + gap * (bitmaps.length - 1);
  const canvasW = isHoriz ? totalMain : maxCross;
  const canvasH = isHoriz ? maxCross  : totalMain;
  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext('2d')!;
  if (background !== 'transparent') { ctx.fillStyle = background; ctx.fillRect(0, 0, canvasW, canvasH); }
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
  const sw = bitmap.width, sh = bitmap.height;
  const sx = Math.round(sw * xPct / 100);
  const sy = Math.round(sh * yPct / 100);
  const cw = Math.round(sw * wPct / 100);
  const ch = Math.round(sh * hPct / 100);
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
  const fitMode    = (options.fitMode as string) || 'cover';
  const rows = Math.ceil(buffers.length / columns);
  const cols = Math.min(columns, buffers.length);
  const canvas = new OffscreenCanvas(cols * cellSize + (cols - 1) * gap, rows * cellSize + (rows - 1) * gap);
  const ctx    = canvas.getContext('2d')!;
  if (background !== 'transparent') { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  for (let i = 0; i < buffers.length; i++) {
    const bitmap = await loadBitmap(buffers[i], fileMimes[i] || 'image/jpeg');
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * (cellSize + gap), y = row * (cellSize + gap);
    if (fitMode === 'contain') {
      const scale = Math.min(cellSize / bitmap.width, cellSize / bitmap.height);
      const dw = bitmap.width * scale, dh = bitmap.height * scale;
      ctx.drawImage(bitmap, x + (cellSize - dw) / 2, y + (cellSize - dh) / 2, dw, dh);
    } else {
      const scale = Math.max(cellSize / bitmap.width, cellSize / bitmap.height);
      const dw = bitmap.width * scale, dh = bitmap.height * scale;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, cellSize, cellSize); ctx.clip();
      ctx.drawImage(bitmap, x + (cellSize - dw) / 2, y + (cellSize - dh) / 2, dw, dh);
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
        for (const p of bucket) { if (p[ch] < min) min = p[ch]; if (p[ch] > max) max = p[ch]; }
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

async function colorPalette(
  buffers: ArrayBuffer[], fileNames: string[], fileMimes: string[],
  options: Record<string, unknown>, onProgress: ProgressFn
): Promise<ProcessResult> {
  const numColors = parseInt(options.colors as string) || 8;
  onProgress(20);
  const bitmap     = await loadBitmap(buffers[0], fileMimes[0]);
  const sampleSize = 150;
  const canvas     = new OffscreenCanvas(sampleSize, sampleSize);
  const ctx        = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, sampleSize, sampleSize);
  bitmap.close();
  onProgress(40);
  const data   = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    pixels.push([data[i], data[i+1], data[i+2]]);
  }
  const palette = medianCut(pixels, numColors);
  onProgress(75);
  const colors = palette.map((c) => ({ hex: rgbToHex(c), r: c[0], g: c[1], b: c[2] }));
  const json   = JSON.stringify({ source: fileNames[0], colors });
  const buffer = new TextEncoder().encode(json).buffer as ArrayBuffer;
  onProgress(100);
  const base = fileNames[0].replace(/\.[^.]+$/, '');
  return { buffer, filename: `${base}_palette.json`, mime: 'application/json' };
}
