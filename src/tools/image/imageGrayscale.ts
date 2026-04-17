import type { Tool } from '../../types';

const imageGrayscale: Tool = {
  id: 'image-grayscale',
  title: 'Image to Grayscale',
  description: 'Convert a color image to black and white in one click.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M12 3v18"/>
    <circle cx="7.5" cy="9" r="1.5"/>
    <path d="M3 16l4-4 5 5"/>
  </svg>`,
  color: '#78909C',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp',
  multiple: false,
};

export default imageGrayscale;
