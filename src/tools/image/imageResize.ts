import type { Tool } from '../../types';

const imageResize: Tool = {
  id: 'image-resize',
  title: 'Resize Image',
  description: 'Resize images to custom dimensions with optional aspect ratio lock.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 3h6v6"/>
    <path d="M9 21H3v-6"/>
    <path d="M21 3l-7 7"/>
    <path d="M3 21l7-7"/>
  </svg>`,
  color: '#9C27B0',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp',
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
