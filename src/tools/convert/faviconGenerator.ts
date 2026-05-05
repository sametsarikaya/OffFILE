import type { Tool } from '../../types';

const faviconGenerator: Tool = {
  id: 'favicon-generator',
  title: 'Favicon Generator',
  description: 'Generate a complete favicon set (16×16 to 512×512) from any PNG or SVG. Packaged as ZIP, 100% offline.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>`,
  color: '#D97706',
  category: 'convert',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.svg,.gif,.avif,.heic,.heif',
  multiple: false,
  maxWarnBytes: 20 * 1024 * 1024,
  options: [
    {
      id: 'format',
      label: 'Output Format',
      type: 'select',
      options: [
        { value: 'png', label: 'PNG (universal)' },
        { value: 'webp', label: 'WebP (smaller)' },
      ],
      defaultValue: 'png',
    },
    {
      id: 'includeSizes',
      label: 'Size Set',
      type: 'select',
      options: [
        { value: 'standard', label: 'Standard (16, 32, 48, 64, 128, 180, 192, 512)' },
        { value: 'minimal', label: 'Minimal (16, 32, 192, 512)' },
        { value: 'apple', label: 'Apple (57, 60, 72, 76, 114, 120, 144, 152, 180)' },
      ],
      defaultValue: 'standard',
    },
  ],
};

export default faviconGenerator;
