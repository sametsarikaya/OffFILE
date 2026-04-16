import type { Tool } from '../../types';

const pdfLock: Tool = {
  id: 'pdf-lock',
  title: 'Lock PDF',
  description: 'Password-protect a PDF. Encrypted locally, nothing uploaded.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>`,
  color: '#F57C00',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'password',
      label: 'Password',
      type: 'text',
      defaultValue: '',
      placeholder: 'Enter password...',
    },
  ],
};

export default pdfLock;
