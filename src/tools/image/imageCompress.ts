import type { Tool } from '../../types';

const imageCompress: Tool = {
  id: 'image-compress',
  title: 'Compress Image',
  description: 'Reduce image file size with adjustable quality and output format.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 14 4 20 10 20"/>
    <polyline points="20 10 20 4 14 4"/>
    <line x1="14" y1="10" x2="21" y2="3"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
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
