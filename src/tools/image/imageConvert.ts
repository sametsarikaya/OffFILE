import type { Tool } from '../../types';

const imageConvert: Tool = {
  id: 'image-convert',
  title: 'Convert Image',
  description: 'Convert images between PNG, JPEG, WebP formats - including SVG.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="0"/>
    <circle cx="9" cy="9" r="2"/>
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
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
