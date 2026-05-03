import type { Tool } from '../../types';

const svgToPng: Tool = {
  id: 'svg-to-png',
  title: 'SVG to PNG/JPG',
  description: 'Convert SVG vector files to raster PNG or JPEG images. SVG must have width/height attributes.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 12h8M12 8l4 4-4 4"/>
  </svg>`,
  color: '#FF7043',
  category: 'convert',
  acceptedTypes: '.svg',
  multiple: false,
  options: [
    {
      id: 'format',
      label: 'Output Format',
      type: 'select',
      options: [
        { value: 'image/png',  label: 'PNG (transparent background)' },
        { value: 'image/jpeg', label: 'JPEG (white background)' },
      ],
      defaultValue: 'image/png',
    },
    {
      id: 'scale',
      label: 'Scale (×)',
      type: 'select',
      options: [
        { value: '1', label: '1× (original size)' },
        { value: '2', label: '2× (double resolution)' },
        { value: '4', label: '4× (high DPI)' },
      ],
      defaultValue: '2',
    },
  ],
};

export default svgToPng;
