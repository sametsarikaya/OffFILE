import { PDFDocument } from 'pdf-lib';
import type { Tool } from '../../types';

const mergePdf: Tool = {
  id: 'merge-pdf',
  title: 'Merge PDF',
  description: 'Combine multiple PDF files into a single document.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 16h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-4"/>
    <path d="M8 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/>
    <rect x="8" y="4" width="8" height="8" rx="0"/>
    <rect x="8" y="12" width="8" height="8" rx="0"/>
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
