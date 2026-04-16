import type { Tool } from '../../types';

const imageGrayscale: Tool = {
  id: 'image-grayscale',
  title: 'Image to Grayscale',
  description: 'Convert a color image to black and white in one click.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 3a9 9 0 0 0 0 18V3z"/>
  </svg>`,
  color: '#78909C',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp',
  multiple: false,
};

export default imageGrayscale;
