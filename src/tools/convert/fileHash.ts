import type { Tool } from '../../types';

const fileHash: Tool = {
  id: 'file-hash',
  title: 'File Hash',
  description: 'Compute SHA-256, SHA-1, SHA-512 and MD5 checksums. 100% offline — no file leaves your browser.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="4" y1="9" x2="20" y2="9"/>
    <line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/>
    <line x1="16" y1="3" x2="14" y2="21"/>
  </svg>`,
  color: '#7C3AED',
  category: 'convert',
  acceptedTypes: '*/*',
  multiple: true,
  maxWarnBytes: 500 * 1024 * 1024,
  options: [
    {
      id: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      options: [
        { value: 'SHA-256', label: 'SHA-256 (recommended)' },
        { value: 'SHA-512', label: 'SHA-512' },
        { value: 'SHA-1', label: 'SHA-1' },
        { value: 'MD5', label: 'MD5' },
        { value: 'ALL', label: 'All algorithms' },
      ],
      defaultValue: 'SHA-256',
    },
  ],
};

export default fileHash;
