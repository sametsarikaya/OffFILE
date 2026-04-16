import type { Tool } from '../../types';

const imageFilters: Tool = {
  id: 'image-filters',
  title: 'Image Filters',
  description: 'Apply visual filters like grayscale, sepia, invert, and blur with adjustable intensity.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </svg>`,
  color: '#AB47BC',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp',
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
