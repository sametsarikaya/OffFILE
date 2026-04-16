import type { Tool } from '../../types';

const pdfToText: Tool = {
  id: 'pdf-to-text',
  title: 'PDF to Text',
  description: 'Extract all plain text from a PDF. Great for searchable content and copy-pasting.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>`,
  color: '#5D4037',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
};

export default pdfToText;
