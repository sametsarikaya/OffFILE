import type { Tool } from '../../types';

const rotatePdf: Tool = {
  id: 'rotate-pdf',
  title: 'Rotate PDF',
  description: 'Rotate all pages of a PDF by 90°, 180°, or 270°.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v7"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M20 8v4"/>
    <path d="M2 14a7 7 0 1 0 7-7"/>
    <polyline points="4 10 2 14 6 14"/>
  </svg>`,
  color: '#F57C00',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'angle',
      label: 'Rotation Angle',
      type: 'select',
      options: [
        { value: '90', label: '90° Clockwise' },
        { value: '180', label: '180°' },
        { value: '270', label: '270° Clockwise' },
      ],
      defaultValue: '90',
    },
  ],
};

export default rotatePdf;
