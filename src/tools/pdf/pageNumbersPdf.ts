import type { Tool } from '../../types';

const pageNumbersPdf: Tool = {
  id: 'page-numbers-pdf',
  title: 'Add Page Numbers',
  description: 'Add page numbers to the bottom of every page in a PDF.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="7" y1="13" x2="11" y2="13"/>
    <line x1="7" y1="17" x2="11" y2="17"/>
    <line x1="8" y1="11" x2="8" y2="19"/>
    <line x1="11" y1="11" x2="11" y2="19"/>
  </svg>`,
  color: '#8BC34A',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'position',
      label: 'Position',
      type: 'select',
      options: [
        { value: 'center', label: 'Bottom Center' },
        { value: 'right', label: 'Bottom Right' },
        { value: 'left', label: 'Bottom Left' },
      ],
      defaultValue: 'center',
    },
    {
      id: 'format',
      label: 'Format',
      type: 'select',
      options: [
        { value: 'number', label: '1, 2, 3...' },
        { value: 'of', label: '1 of N' },
        { value: 'dash', label: '- 1 -' },
      ],
      defaultValue: 'number',
    },
  ],
};

export default pageNumbersPdf;
