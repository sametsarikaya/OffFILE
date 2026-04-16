import { PDFDocument, degrees } from 'pdf-lib';
import type { Tool } from '../../types';

const rotatePdf: Tool = {
  id: 'rotate-pdf',
  title: 'Rotate PDF',
  description: 'Rotate all pages of a PDF by 90°, 180°, or 270°.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.5 2v6h-6"/>
    <path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/>
  </svg>`,
  color: '#F57C00',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'angle',
      label: 'Rotation Angle',
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

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    onProgress(40);

    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const currentRotation = pages[i].getRotation().angle;
      pages[i].setRotation(degrees(currentRotation + angle));
      onProgress(40 + (i / pages.length) * 40);
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    onProgress(100);

    const baseName = file.name.replace(/\.pdf$/i, '');
    return { blob, filename: `${baseName}_rotated.pdf` };
  },
};

export default rotatePdf;
