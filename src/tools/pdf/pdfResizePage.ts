import type { Tool } from '../../types';

const pdfResizePage: Tool = {
  id: 'pdf-resize-page',
  title: 'Resize PDF Pages',
  description: 'Change all pages to A4, A3, US Letter, or a custom size - keeping content centered.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="1"/>
    <polyline points="8 2 4 2 4 6"/>
    <polyline points="16 2 20 2 20 6"/>
    <polyline points="8 22 4 22 4 18"/>
    <polyline points="16 22 20 22 20 18"/>
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
