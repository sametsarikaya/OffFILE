import type { Tool } from '../../types';

const extractZip: Tool = {
  id: 'extract-zip',
  title: 'Extract ZIP',
  description: 'Open a ZIP archive and download individual files from it.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
  </svg>`,
  color: '#66BB6A',
  category: 'convert',
  acceptedTypes: '.zip',
  multiple: false,
};

export default extractZip;
