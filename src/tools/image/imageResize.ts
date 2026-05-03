import type { Tool } from '../../types';

const imageResize: Tool = {
  id: 'image-resize',
  title: 'Resize Image',
  description: 'Resize images to custom dimensions with optional aspect ratio lock.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="1"/>
    <path d="M6 6L3 3m0 0h4m-4 0v4"/>
    <path d="M18 6l3-3m0 0h-4m4 0v4"/>
    <path d="M6 18l-3 3m0 0h4m-4 0v-4"/>
    <path d="M18 18l3 3m0 0h-4m4 0v-4"/>
  </svg>`,
  color: '#9C27B0',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp,.avif,.heic,.heif',
  multiple: false,
  options: [
    {
      id: 'width',
      label: 'Width (px)',
      type: 'number',
      min: 1,
      max: 10000,
      defaultValue: 800,
    },
    {
      id: 'height',
      label: 'Height (px) - ignored when aspect ratio is locked',
      type: 'number',
      min: 1,
      max: 10000,
      defaultValue: 600,
    },
    {
      id: 'keepRatio',
      label: 'Lock aspect ratio (height auto-calculated from width)',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
};

export default imageResize;
