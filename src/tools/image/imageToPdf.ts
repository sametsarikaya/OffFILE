import { jsPDF } from 'jspdf';
import type { Tool } from '../../types';

const imageToPdf: Tool = {
  id: 'image-to-pdf',
  title: 'Image to PDF',
  description: 'Combine your images into a single PDF document.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="10" height="12" rx="1"/>
    <circle cx="5.5" cy="6.5" r="1.5"/>
    <path d="M2 15l3.5-3.5 3 3 3-3"/>
    <line x1="12" y1="9" x2="14" y2="9"/>
    <polyline points="13 7 15 9 13 11"/>
    <path d="M17 2h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V11"/>
  </svg>`,
  color: '#D84315',
  category: 'convert',
  acceptedTypes: '.png,.jpg,.jpeg,.webp',
  multiple: true,
  options: [
    {
      id: 'pageSize',
      label: 'Page Size',
      type: 'select',
      options: [
        { value: 'a4', label: 'A4' },
        { value: 'letter', label: 'Letter' },
        { value: 'fit', label: 'Fit to Image' },
      ],
      defaultValue: 'a4',
    },
  ],

  async process(files, options, onProgress) {
    const pageSize = (options.pageSize as string) || 'a4';
    const totalFiles = files.length;

    let doc: jsPDF | null = null;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const img = await loadImage(file);

      if (pageSize === 'fit') {
        // Page size based on image dimensions (in mm, 72dpi approx)
        const widthMM = (img.naturalWidth * 25.4) / 96;
        const heightMM = (img.naturalHeight * 25.4) / 96;

        if (i === 0) {
          doc = new jsPDF({
            orientation: widthMM > heightMM ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [widthMM, heightMM],
          });
        } else {
          doc!.addPage([widthMM, heightMM], widthMM > heightMM ? 'landscape' : 'portrait');
        }

        doc!.addImage(
          img,
          'JPEG',
          0,
          0,
          widthMM,
          heightMM
        );
      } else {
        if (i === 0) {
          doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: pageSize,
          });
        } else {
          doc!.addPage(pageSize, 'portrait');
        }

        const pageWidth = doc!.internal.pageSize.getWidth();
        const pageHeight = doc!.internal.pageSize.getHeight();

        // Fit image to page with margins
        const margin = 10;
        const availableW = pageWidth - margin * 2;
        const availableH = pageHeight - margin * 2;

        const imgRatio = img.naturalWidth / img.naturalHeight;
        const pageRatio = availableW / availableH;

        let drawW: number, drawH: number;
        if (imgRatio > pageRatio) {
          drawW = availableW;
          drawH = availableW / imgRatio;
        } else {
          drawH = availableH;
          drawW = availableH * imgRatio;
        }

        const x = margin + (availableW - drawW) / 2;
        const y = margin + (availableH - drawH) / 2;

        doc!.addImage(img, 'JPEG', x, y, drawW, drawH);
      }

      onProgress(((i + 1) / totalFiles) * 100);
    }

    const blob = doc!.output('blob');

    return {
      blob,
      filename: 'images.pdf',
    };
  },
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = URL.createObjectURL(file);
  });
}

export default imageToPdf;
