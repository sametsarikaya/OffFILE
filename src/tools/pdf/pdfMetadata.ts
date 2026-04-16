import type { Tool } from '../../types';

const pdfMetadata: Tool = {
  id: 'pdf-metadata',
  title: 'PDF Metadata',
  description: 'View or strip the hidden metadata (title, author, creator) from a PDF.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>`,
  color: '#37474F',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'mode',
      label: 'Action',
      type: 'select',
      options: [
        { value: 'view',  label: 'View metadata report (TXT)' },
        { value: 'strip', label: 'Strip & clean metadata (PDF)' },
      ],
      defaultValue: 'view',
    },
  ],
};

export default pdfMetadata;
