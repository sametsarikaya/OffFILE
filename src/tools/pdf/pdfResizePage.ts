import type { Tool } from '../../types';

const pdfResizePage: Tool = {
  id: 'pdf-resize-page',
  title: 'Resize PDF Pages',
  description: 'Change all pages to A4, A3, US Letter, or a custom size - keeping content centered.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
    <line x1="3"  y1="21" x2="10" y2="14"/>
  </svg>`,
  color: '#42A5F5',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'size',
      label: 'Target page size',
      type: 'select',
      options: [
        { value: 'a4',     label: 'A4 (210 × 297 mm)'     },
        { value: 'a3',     label: 'A3 (297 × 420 mm)'     },
        { value: 'letter', label: 'US Letter (8.5 × 11 in)' },
        { value: 'legal',  label: 'US Legal (8.5 × 14 in)'  },
      ],
      defaultValue: 'a4',
    },
    {
      id: 'orientation',
      label: 'Orientation',
      type: 'select',
      options: [
        { value: 'portrait',  label: 'Portrait'  },
        { value: 'landscape', label: 'Landscape' },
      ],
      defaultValue: 'portrait',
    },
  ],
};

export default pdfResizePage;
