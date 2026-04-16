import { PDFDocument } from 'pdf-lib';
import type { Tool } from '../../types';

const removePdfPages: Tool = {
  id: 'remove-pdf-pages',
  title: 'Remove Pages',
  description: 'Remove specific pages from a PDF document.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>`,
  color: '#F44336',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'pages',
      label: 'Page to Remove (number)',
      type: 'number',
      min: 1,
      max: 9999,
      defaultValue: 1,
    },
  ],

  async process(files, options, onProgress) {
    const file = files[0];
    const pageToRemove = Math.max(1, Number(options.pages) || 1);
    onProgress(20);

    const arrayBuffer = await file.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = srcDoc.getPageCount();
    onProgress(40);

    if (pageToRemove > totalPages) {
      throw new Error(`Page ${pageToRemove} doesn't exist. PDF has ${totalPages} pages.`);
    }
    if (totalPages <= 1) {
      throw new Error('Cannot remove the only page from a PDF.');
    }

    const newDoc = await PDFDocument.create();
    const indices = Array.from({ length: totalPages }, (_, i) => i)
      .filter((i) => i !== pageToRemove - 1);
    
    const copiedPages = await newDoc.copyPages(srcDoc, indices);
    copiedPages.forEach((page) => newDoc.addPage(page));
    onProgress(80);

    const pdfBytes = await newDoc.save();
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    onProgress(100);

    const baseName = file.name.replace(/\.pdf$/i, '');
    return { blob, filename: `${baseName}_removed_p${pageToRemove}.pdf` };
  },
};

export default removePdfPages;
