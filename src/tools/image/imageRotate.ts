import type { Tool } from '../../types';

const imageRotate: Tool = {
  id: 'image-rotate',
  title: 'Rotate Image',
  description: 'Rotate your image by 90°, 180°, or 270°.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="5" width="14" height="14" rx="1"/>
    <circle cx="7.5" cy="9" r="1.5"/>
    <path d="M3 15l4-4 4 4"/>
    <path d="M21 4h-4v4"/>
    <path d="M17 8a6 6 0 0 0-4-6"/>
  </svg>`,
  color: '#FFA726',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp,.avif,.heic,.heif',
  multiple: false,
  options: [
    {
      id: 'angle',
      label: 'Rotation',
      type: 'select',
      options: [
        { value: '90', label: '90° Clockwise' },
        { value: '180', label: '180°' },
        { value: '270', label: '270° Clockwise' },
      ],
      defaultValue: '90',
    },
  ],
};
export default imageRotate;
