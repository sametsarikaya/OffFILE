import type { Tool } from '../../types';

const pdfToImage: Tool = {
  id: 'pdf-to-image',
  title: 'PDF to Image',
  description: 'Convert a PDF page to a high-quality PNG or JPEG image.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <rect x="7" y="12" width="10" height="7" rx="1"/>
    <circle cx="10" cy="14.5" r="1"/>
    <path d="m17 19-2.5-2.5-2 1.5-1.5-1.5-2 2.5"/>
  </svg>`,
  color: '#6A1B9A',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'page',
      label: 'Page number',
      type: 'number',
      min: 1,
      max: 9999,
      defaultValue: 1,
    },
    {
      id: 'format',
      label: 'Output format',
      type: 'select',
      options: [
        { value: 'image/png',  label: 'PNG (lossless)' },
        { value: 'image/jpeg', label: 'JPEG (smaller file)' },
      ],
      defaultValue: 'image/png',
    },
    {
      id: 'scale',
      label: 'Resolution scale',
      type: 'select',
      options: [
        { value: '1',   label: '1× - Screen quality' },
        { value: '2',   label: '2× - High quality (default)' },
        { value: '3',   label: '3× - Print quality' },
      ],
      defaultValue: '2',
    },
  ],
};

export default pdfToImage;
