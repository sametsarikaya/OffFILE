import type { Tool } from '../../types';

const stripMetadata: Tool = {
  id: 'strip-metadata',
  title: 'Strip Metadata',
  description: 'Remove EXIF data, GPS location, and other metadata from images.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="0"/>
    <circle cx="12" cy="12" r="3"/>
    <line x1="3" y1="3" x2="21" y2="21"/>
  </svg>`,
  color: '#546E7A',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp',
  multiple: false,

  async process(files, _options, onProgress) {
    const file = files[0];
    onProgress(20);

    const img = await loadImage(file);
    onProgress(50);

    // Redrawing to canvas strips all EXIF/metadata
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    onProgress(70);

    const outType = file.type || 'image/png';
    const quality = outType === 'image/png' ? undefined : 0.95;
    const blob = await canvasToBlob(canvas, outType, quality);
    onProgress(100);

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = file.name.split('.').pop() || 'png';
    return { blob, filename: `${baseName}_clean.${ext}` };
  },
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed.'))),
      type, quality
    );
  });
}

export default stripMetadata;
