import type { Tool } from '../../types';

const watermarkPdf: Tool = {
  id: 'watermark-pdf',
  title: 'PDF Watermark',
  description: 'Add a diagonal text watermark to every page of a PDF.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M7 18.5l10-7"/>
    <path d="M7 14.5l7-5"/>
  </svg>`,
  color: '#558B2F',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'text',
      label: 'Watermark Text',
      type: 'text',
      defaultValue: 'CONFIDENTIAL',
      placeholder: 'e.g. DRAFT, SAMPLE, DO NOT COPY',
    },
    {
      id: 'opacity',
      label: 'Opacity',
      type: 'range',
      min: 5,
      max: 50,
      step: 5,
      defaultValue: 15,
    },
  ],
};

export default watermarkPdf;
