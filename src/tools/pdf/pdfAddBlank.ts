import type { Tool } from '../../types';

const pdfAddBlank: Tool = {
  id: 'pdf-add-blank',
  title: 'Add Blank Page to PDF',
  description: 'Insert a blank page at the beginning, end, or after a specific page.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="11" x2="12" y2="17"/>
    <line x1="9"  y1="14" x2="15" y2="14"/>
  </svg>`,
  color: '#AD1457',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'position',
      label: 'Insert position',
      type: 'select',
      options: [
        { value: 'start', label: 'Beginning of document' },
        { value: 'end',   label: 'End of document'       },
        { value: 'after', label: 'After page number...'    },
      ],
      defaultValue: 'end',
    },
    {
      id: 'afterPage',
      label: 'After page number',
      type: 'number',
      min: 1,
      max: 9999,
      step: 1,
      defaultValue: 1,
    },
    {
      id: 'size',
      label: 'Blank page size',
      type: 'select',
      options: [
        { value: 'match',  label: 'Match existing pages' },
        { value: 'a4',     label: 'A4'                   },
        { value: 'letter', label: 'US Letter'            },
      ],
      defaultValue: 'match',
    },
  ],
};

export default pdfAddBlank;
