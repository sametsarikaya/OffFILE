import { PDFDocument } from 'pdf-lib';
import type { Tool } from '../../types';

const mergePdf: Tool = {
  id: 'merge-pdf',
  title: 'Merge PDF',
  description: 'Combine multiple PDF files into a single document.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="7" height="10" rx="1"/>
    <rect x="15" y="2" width="7" height="10" rx="1"/>
    <path d="M9 7h6"/>
    <path d="M12 12v7"/>
    <path d="M9 17l3 3 3-3"/>
  </svg>`,
  color: '#FF5252',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: true,

  async process(files, _options, onProgress) {
    const mergedPdf = await PDFDocument.create();
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const arrayBuffer = await files[i].arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
      onProgress(((i + 1) / totalFiles) * 100);
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

    return {
      blob,
      filename: 'merged.pdf',
    };
  },
};

export default mergePdf;
