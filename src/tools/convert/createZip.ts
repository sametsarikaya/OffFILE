import type { Tool } from '../../types';

const createZip: Tool = {
  id: 'create-zip',
  title: 'Create ZIP',
  description: 'Bundle multiple files into a single ZIP archive. All compression happens locally.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
    <rect x="9" y="12" width="6" height="4" rx="1"/>
  </svg>`,
  color: '#FFA726',
  category: 'convert',
  acceptedTypes: '*',
  multiple: true,
  options: [
    {
      id: 'compression',
      label: 'Compression Level',
      type: 'select',
      options: [
        { value: '0', label: 'None (fastest, largest)' },
        { value: '6', label: 'Normal (balanced)' },
        { value: '9', label: 'Maximum (slowest, smallest)' },
      ],
      defaultValue: '6',
    },
  ],
};

export default createZip;
