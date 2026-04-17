import type { Tool } from '../../types';

const pdfToText: Tool = {
  id: 'pdf-to-text',
  title: 'PDF to Text',
  description: 'Extract all plain text from a PDF. Great for searchable content and copy-pasting.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="9" height="13" rx="1"/>
    <line x1="11" y1="9" x2="13" y2="9"/>
    <polyline points="12 7 14 9 12 11"/>
    <line x1="15" y1="6" x2="22" y2="6"/>
    <line x1="15" y1="10" x2="22" y2="10"/>
    <line x1="15" y1="14" x2="20" y2="14"/>
  </svg>`,
  color: '#5D4037',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
};

export default pdfToText;
