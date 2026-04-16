import type { Tool } from '../../types';

const imageRotate: Tool = {
  id: 'image-rotate',
  title: 'Rotate Image',
  description: 'Rotate your image by 90°, 180°, or 270°.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.5 2v6h-6"/>
    <path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/>
  </svg>`,
  color: '#FFA726',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp',
  multiple: false,
  options: [
    {
      id: 'angle',
      label: 'Rotation',
      type: 'select',
      options: [
        { value: '90', label: '90° Clockwise' },
        { value: '180', label: '180°' },
        { value: '270', label: '270° Clockwise' },
      ],
      defaultValue: '90',
    },
  ],

  async process(files, options, onProgress) {
    const file = files[0];
    const angle = parseInt(options.angle as string) || 90;
    onProgress(20);

    const img = await loadImage(file);
    onProgress(40);

    const rad = (angle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * cos + img.naturalHeight * sin);
    canvas.height = Math.round(img.naturalWidth * sin + img.naturalHeight * cos);

    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    onProgress(80);

    const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, outType);
    onProgress(100);

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = outType === 'image/png' ? 'png' : 'jpg';
    return { blob, filename: `${baseName}_rotated${angle}.${ext}` };
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
      (b) => (b ? resolve(b) : reject(new Error('Rotation failed.'))),
      type, 0.92
    );
  });
}

export default imageRotate;
