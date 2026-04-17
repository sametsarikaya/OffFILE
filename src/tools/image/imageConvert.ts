import type { Tool } from '../../types';

const imageConvert: Tool = {
  id: 'image-convert',
  title: 'Convert Image',
  description: 'Convert images between PNG, JPEG, WebP formats - including SVG.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="8" height="8" rx="1"/>
    <circle cx="5" cy="7" r="1"/>
    <path d="M2 12l2.5 2 2.5-2"/>
    <rect x="14" y="12" width="8" height="8" rx="1"/>
    <circle cx="17" cy="15" r="1"/>
    <path d="M22 12l-2.5-2-2.5 2"/>
    <path d="M10 8h2a2 2 0 0 1 2 2v2"/>
    <path d="M14 16h-2a2 2 0 0 1-2-2v-2"/>
  </svg>`,
  color: '#2196F3',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp,.svg',
  multiple: false,
  maxWarnBytes: 50 * 1024 * 1024,
  options: [
    {
      id: 'format',
      label: 'Target Format',
      type: 'select',
      options: [
        { value: 'image/png',  label: 'PNG' },
        { value: 'image/jpeg', label: 'JPEG' },
        { value: 'image/webp', label: 'WebP' },
      ],
      defaultValue: 'image/png',
    },
  ],
};

export default imageConvert;
