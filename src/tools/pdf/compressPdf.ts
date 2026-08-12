import type { Tool } from '../../types';

const compressPdf: Tool = {
  id: 'compress-pdf',
  title: 'Compress PDF',
  description:
    'Shrink a PDF. Lossless keeps text selectable and searchable; rasterise trades that away for a much smaller file.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <polyline points="8 14 12 17 16 14"/>
    <polyline points="8 17 12 14 16 17"/>
  </svg>`,
  color: '#43A047',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'mode',
      label: 'Method',
      type: 'select',
      options: [
        { value: 'lossless', label: 'Lossless - text stays selectable' },
        { value: 'raster', label: 'Rasterise - smaller, text becomes an image' },
      ],
      defaultValue: 'lossless',
    },
    {
      id: 'quality',
      label: 'Rasterise quality (ignored in lossless mode)',
      type: 'select',
      options: [
        { value: 'low', label: 'Low (smallest file)' },
        { value: 'medium', label: 'Medium (balanced)' },
        { value: 'high', label: 'High (best quality)' },
      ],
      defaultValue: 'medium',
    },
  ],
};

export default compressPdf;
