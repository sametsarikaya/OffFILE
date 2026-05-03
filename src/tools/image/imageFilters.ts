import type { Tool } from '../../types';

const imageFilters: Tool = {
  id: 'image-filters',
  title: 'Image Filters',
  description: 'Apply visual filters like grayscale, sepia, invert, and blur with adjustable intensity.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="20" height="13" rx="2"/>
    <circle cx="7" cy="7.5" r="1.5"/>
    <path d="M2 11l4-4 3 3 4-4 5 5"/>
    <line x1="4" y1="19" x2="20" y2="19"/>
    <circle cx="9" cy="19" r="2"/>
    <circle cx="16" cy="19" r="2"/>
  </svg>`,
  color: '#AB47BC',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp,.avif,.heic,.heif',
  multiple: false,
  options: [
    {
      id: 'filter',
      label: 'Filter type',
      type: 'select',
      options: [
        { value: 'grayscale',  label: 'Grayscale' },
        { value: 'sepia',      label: 'Sepia' },
        { value: 'invert',     label: 'Invert Colors' },
        { value: 'brightness', label: 'Brighten' },
        { value: 'contrast',   label: 'High Contrast' },
        { value: 'blur',       label: 'Blur' },
        { value: 'saturate',   label: 'Saturate' },
      ],
      defaultValue: 'grayscale',
    },
    {
      id: 'intensity',
      label: 'Intensity (%)',
      type: 'range',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 100,
    },
  ],
};

export default imageFilters;
