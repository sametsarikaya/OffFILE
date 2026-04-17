import type { Tool } from '../../types';

const imageCompress: Tool = {
  id: 'image-compress',
  title: 'Compress Image',
  description: 'Reduce image file size with adjustable quality and output format.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <path d="M3 15l5-5 4 4 3-3 4 4"/>
    <path d="M19 5l-3 3m0 0v-3m0 3h-3"/>
    <path d="M5 19l3-3m0 0v3m0-3H5"/>
  </svg>`,
  color: '#FF9800',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp',
  multiple: false,
  options: [
    {
      id: 'quality',
      label: 'Quality (%)',
      type: 'range',
      min: 10,
      max: 100,
      step: 5,
      defaultValue: 70,
    },
    {
      id: 'format',
      label: 'Output format',
      type: 'select',
      options: [
        { value: 'image/jpeg', label: 'JPEG (best compression)' },
        { value: 'image/webp', label: 'WebP (modern, smaller)' },
        { value: 'image/png',  label: 'PNG (lossless)' },
      ],
      defaultValue: 'image/jpeg',
    },
  ],
};

export default imageCompress;
