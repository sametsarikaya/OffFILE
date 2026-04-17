import type { Tool } from '../../types';

const imageAddBg: Tool = {
  id: 'image-add-bg',
  title: 'Add Background to PNG',
  description: 'Replace transparent areas in a PNG with a solid background color.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 3"/>
    <rect x="6" y="6" width="12" height="12" rx="1"/>
    <circle cx="9.5" cy="9.5" r="1.5"/>
    <path d="M6 18l3.5-3.5 2.5 2 2.5-2.5 3.5 4"/>
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
