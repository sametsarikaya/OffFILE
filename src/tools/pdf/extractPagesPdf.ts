import type { Tool } from '../../types';

const extractPagesPdf: Tool = {
  id: 'extract-pages-pdf',
  title: 'Extract Pages',
  description: 'Extract a range of pages from a PDF into a new document.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M8 13h8"/>
    <path d="M12 17V9"/>
    <polyline points="9 12 12 9 15 12"/>
  </svg>`,
  color: '#00897B',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'from',
      label: 'From Page',
      type: 'number',
      min: 1,
      max: 9999,
      defaultValue: 1,
    },
    {
      id: 'to',
      label: 'To Page',
      type: 'number',
      min: 1,
      max: 9999,
      defaultValue: 3,
    },
  ],
};

export default extractPagesPdf;
