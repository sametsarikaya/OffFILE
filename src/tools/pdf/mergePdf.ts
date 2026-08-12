import type { Tool } from '../../types';

const mergePdf: Tool = {
  id: 'merge-pdf',
  title: 'Merge PDF',
  description: 'Combine multiple PDF files into a single document.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="7" height="10" rx="1"/>
    <rect x="15" y="2" width="7" height="10" rx="1"/>
    <path d="M9 7h6"/>
    <path d="M12 12v7"/>
    <path d="M9 17l3 3 3-3"/>
  </svg>`,
  color: '#FF5252',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: true,
};

export default mergePdf;
