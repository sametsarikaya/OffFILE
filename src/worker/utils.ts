export class OffscreenCanvasFactory {
  constructor(_opts?: unknown) {}
  create(width: number, height: number) {
    const canvas  = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
    const context = canvas.getContext('2d')!;
    return { canvas: canvas as unknown as HTMLCanvasElement, context: context as unknown as CanvasRenderingContext2D };
  }
  reset(cc: { canvas: unknown }, width: number, height: number) {
    const c = cc.canvas as OffscreenCanvas;
    c.width  = Math.max(1, width);
    c.height = Math.max(1, height);
  }
  destroy(cc: { canvas: unknown }) {
    const c = cc.canvas as OffscreenCanvas;
    c.width = 0; c.height = 0;
  }
}

export async function loadBitmap(buffer: ArrayBuffer, mime: string): Promise<ImageBitmap> {
  const blob = new Blob([buffer], { type: mime || 'image/png' });
  return createImageBitmap(blob);
}

export async function bitmapToBuffer(
  bitmap: ImageBitmap, mime: string, quality = 0.92
): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx    = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: mime, quality });
  return blob.arrayBuffer();
}

export function outMime(fileMime: string, forced?: string): string {
  if (forced) return forced;
  return fileMime === 'image/png' ? 'image/png' : 'image/jpeg';
}

export function outExt(mime: string): string {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
}
