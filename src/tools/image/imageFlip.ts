import type { Tool } from '../../types';

const imageFlip: Tool = {
  id: 'image-flip',
  title: 'Flip Image',
  description: 'Mirror your image horizontally or vertically.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="8" height="14" rx="1"/>
    <circle cx="6" cy="8" r="1"/>
    <path d="M2 18l3-3.5 3 3.5"/>
    <rect x="14" y="4" width="8" height="14" rx="1"/>
    <circle cx="18" cy="8" r="1"/>
    <path d="M22 18l-3-3.5-3 3.5"/>
    <line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="3 2"/>
  </svg>`,
  color: '#26C6DA',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp,.avif,.heic,.heif',
  multiple: false,
  options: [
    {
      id: 'direction',
      label: 'Flip Direction',
      type: 'select',
      options: [
        { value: 'horizontal', label: 'Horizontal (Mirror)' },
        { value: 'vertical', label: 'Vertical (Upside Down)' },
        { value: 'both', label: 'Both' },
      ],
      defaultValue: 'horizontal',
    },
  ],
};
export default imageFlip;
