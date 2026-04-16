import type { Tool } from '../../types';

const imageAddBg: Tool = {
  id: 'image-add-bg',
  title: 'Add Background to PNG',
  description: 'Replace transparent areas in a PNG with a solid background color.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="16" height="16" rx="1"/>
    <circle cx="6" cy="8" r="1.5"/>
    <path d="m18 18-4-4-3 3"/>
    <line x1="19" y1="5" x2="19" y2="11"/>
    <line x1="16" y1="8" x2="22" y2="8"/>
  </svg>`,
  color: '#26A69A',
  category: 'image',
  acceptedTypes: '.png',
  multiple: false,
  options: [
    {
      id: 'color',
      label: 'Background color',
      type: 'text',
      defaultValue: '#ffffff',
      placeholder: '#ffffff',
    },
  ],
};

export default imageAddBg;
