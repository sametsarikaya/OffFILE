import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import type { Tool } from '../../types';

const watermarkPdf: Tool = {
  id: 'watermark-pdf',
  title: 'PDF Watermark',
  description: 'Add a diagonal text watermark to every page of a PDF.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="18" x2="14" y2="12"/>
    <line x1="12" y1="18" x2="16" y2="14"/>
  </svg>`,
  color: '#558B2F',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'text',
      label: 'Watermark Text',
      type: 'select',
      options: [
        { value: 'CONFIDENTIAL', label: 'CONFIDENTIAL' },
        { value: 'DRAFT', label: 'DRAFT' },
        { value: 'SAMPLE', label: 'SAMPLE' },
        { value: 'DO NOT COPY', label: 'DO NOT COPY' },
      ],
      defaultValue: 'CONFIDENTIAL',
    },
    {
      id: 'opacity',
      label: 'Opacity',
      type: 'range',
      min: 5,
      max: 50,
      step: 5,
      defaultValue: 15,
    },
  ],

  async process(files, options, onProgress) {
    const file = files[0];
    const text = (options.text as string) || 'CONFIDENTIAL';
    const opacity = (Number(options.opacity) || 15) / 100;
    onProgress(20);

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    onProgress(40);

    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) / (text.length * 0.7);

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = fontSize;

      page.drawText(text, {
        x: (width - textWidth * 0.7) / 2,
        y: (height - textHeight) / 2,
        size: fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity,
        rotate: degrees(-45),
      });

      onProgress(40 + (i / pages.length) * 50);
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    onProgress(100);

    const baseName = file.name.replace(/\.pdf$/i, '');
    return { blob, filename: `${baseName}_watermarked.pdf` };
  },
};

export default watermarkPdf;
