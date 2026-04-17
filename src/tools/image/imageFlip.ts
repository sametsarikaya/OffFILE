import type { Tool } from '../../types';

const imageFlip: Tool = {
  id: 'image-flip',
  title: 'Flip Image',
  description: 'Mirror your image horizontally or vertically.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="8" height="14" rx="1"/>
    <circle cx="6" cy="8" r="1"/>
    <path d="M2 18l3-3.5 3 3.5"/>
    <rect x="14" y="4" width="8" height="14" rx="1"/>
    <circle cx="18" cy="8" r="1"/>
    <path d="M22 18l-3-3.5-3 3.5"/>
    <line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="3 2"/>
  </svg>`,
  color: '#26C6DA',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp',
  multiple: false,
  options: [
    {
      id: 'direction',
      label: 'Flip Direction',
      type: 'select',
      options: [
        { value: 'horizontal', label: 'Horizontal (Mirror)' },
        { value: 'vertical', label: 'Vertical (Upside Down)' },
        { value: 'both', label: 'Both' },
      ],
      defaultValue: 'horizontal',
    },
  ],

  async process(files, options, onProgress) {
    const file = files[0];
    const direction = (options.direction as string) || 'horizontal';
    onProgress(20);

    const img = await loadImage(file);
    onProgress(40);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.save();
    if (direction === 'horizontal' || direction === 'both') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    if (direction === 'vertical' || direction === 'both') {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    onProgress(80);

    const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, outType);
    onProgress(100);

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = outType === 'image/png' ? 'png' : 'jpg';
    return { blob, filename: `${baseName}_flipped.${ext}` };
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Flip failed.'))),
      type, 0.92
    );
  });
}

export default imageFlip;
