import type { Tool } from '../../types';

const imageToPdf: Tool = {
  id: 'image-to-pdf',
  title: 'Image to PDF',
  description: 'Combine your images into a single PDF document.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="10" height="12" rx="1"/>
    <circle cx="5.5" cy="6.5" r="1.5"/>
    <path d="M2 15l3.5-3.5 3 3 3-3"/>
    <line x1="12" y1="9" x2="14" y2="9"/>
    <polyline points="13 7 15 9 13 11"/>
    <path d="M17 2h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V11"/>
  </svg>`,
  color: '#D84315',
  category: 'convert',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.avif,.heic,.heif',
  multiple: true,
  options: [
    {
      id: 'pageSize',
      label: 'Page Size',
      type: 'select',
      options: [
        { value: 'a4', label: 'A4' },
        { value: 'letter', label: 'Letter' },
        { value: 'fit', label: 'Fit to Image' },
      ],
      defaultValue: 'a4',
    },
  ],
};
export default imageToPdf;
