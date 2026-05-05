import type { Tool } from '../../types';

const textToPdf: Tool = {
  id: 'text-to-pdf',
  title: 'Text to PDF',
  description: 'Convert plain text or Markdown to a PDF. Formatted locally, nothing uploaded.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>`,
  color: '#0284C7',
  category: 'convert',
  acceptedTypes: '.txt,.md,.text,.markdown,.csv',
  multiple: false,
  maxWarnBytes: 10 * 1024 * 1024,
  options: [
    {
      id: 'pageSize',
      label: 'Page Size',
      type: 'select',
      options: [
        { value: 'a4', label: 'A4' },
        { value: 'letter', label: 'US Letter' },
        { value: 'a3', label: 'A3' },
      ],
      defaultValue: 'a4',
    },
    {
      id: 'fontSize',
      label: 'Font Size (pt)',
      type: 'number',
      min: 6,
      max: 36,
      step: 1,
      defaultValue: 11,
    },
    {
      id: 'marginMm',
      label: 'Margin (mm)',
      type: 'number',
      min: 5,
      max: 50,
      step: 1,
      defaultValue: 20,
    },
    {
      id: 'lineHeight',
      label: 'Line Height',
      type: 'select',
      options: [
        { value: '1.2', label: 'Compact (1.2×)' },
        { value: '1.5', label: 'Normal (1.5×)' },
        { value: '2.0', label: 'Wide (2.0×)' },
      ],
      defaultValue: '1.5',
    },
  ],
};

export default textToPdf;
