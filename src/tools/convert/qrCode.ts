import type { Tool } from '../../types';

const qrCode: Tool = {
  id: 'qr-code',
  title: 'QR Code Generator',
  description: 'Generate a QR code from any text or URL. Exported as PNG, nothing leaves your browser.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="8" height="8" rx="1"/>
    <rect x="14" y="2" width="8" height="8" rx="1"/>
    <rect x="2" y="14" width="8" height="8" rx="1"/>
    <rect x="5" y="5" width="2" height="2"/>
    <rect x="17" y="5" width="2" height="2"/>
    <rect x="5" y="17" width="2" height="2"/>
    <line x1="14" y1="14" x2="14" y2="14"/>
    <line x1="19" y1="14" x2="19" y2="14"/>
    <line x1="14" y1="19" x2="14" y2="19"/>
    <line x1="22" y1="14" x2="22" y2="14"/>
    <line x1="14" y1="22" x2="22" y2="22"/>
  </svg>`,
  color: '#26C6DA',
  category: 'convert',
  acceptedTypes: '',
  multiple: false,
  options: [
    {
      id: 'text',
      label: 'Text or URL',
      type: 'text',
      defaultValue: '',
      placeholder: 'Enter text or URL...',
    },
    {
      id: 'size',
      label: 'Output Size (px)',
      type: 'select',
      options: [
        { value: '256',  label: '256 × 256' },
        { value: '512',  label: '512 × 512' },
        { value: '1024', label: '1024 × 1024' },
      ],
      defaultValue: '512',
    },
    {
      id: 'errorLevel',
      label: 'Error Correction',
      type: 'select',
      options: [
        { value: 'L', label: 'Low (7%)' },
        { value: 'M', label: 'Medium (15%)' },
        { value: 'Q', label: 'Quartile (25%)' },
        { value: 'H', label: 'High (30%)' },
      ],
      defaultValue: 'M',
    },
    {
      id: 'darkColor',
      label: 'Dark Color',
      type: 'text',
      defaultValue: '#000000',
      placeholder: '#000000',
    },
    {
      id: 'lightColor',
      label: 'Light Color',
      type: 'text',
      defaultValue: '#ffffff',
      placeholder: '#ffffff',
    },
  ],
};

export default qrCode;
