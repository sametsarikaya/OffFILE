import type { Tool } from '../../types';

const pdfAddBlank: Tool = {
  id: 'pdf-add-blank',
  title: 'Add Blank Page to PDF',
  description: 'Insert a blank page at the beginning, end, or after a specific page.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="13" height="18" rx="1"/>
    <path d="M18 8h4"/>
    <path d="M20 6v4"/>
    <line x1="8" y1="9" x2="12" y2="9"/>
    <line x1="8" y1="13" x2="12" y2="13"/>
    <line x1="8" y1="17" x2="10" y2="17"/>
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
