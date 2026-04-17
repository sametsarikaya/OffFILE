import type { Tool } from '../../types';

const removePdfPages: Tool = {
  id: 'remove-pdf-pages',
  title: 'Remove Pages',
  description: 'Remove one or more pages from a PDF. Supports single pages and ranges (e.g. 2, 5-8, 10).',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="19"/>
    <line x1="15" y1="13" x2="9" y2="19"/>
  </svg>`,
  color: '#F44336',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'pages',
      label: 'Pages to Remove',
      type: 'text',
      defaultValue: '1',
      placeholder: 'e.g. 2, 5-8, 10',
    },
  ],
};

export default removePdfPages;
