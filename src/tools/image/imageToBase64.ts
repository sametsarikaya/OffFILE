import type { Tool } from '../../types';

const imageToBase64: Tool = {
  id: 'image-to-base64',
  title: 'Image to Base64',
  description: 'Convert images to Base64 encoded text for use in HTML or CSS.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="10" height="12" rx="1"/>
    <circle cx="6" cy="7" r="1.5"/>
    <path d="M2 15l4-4 3 3 3-3"/>
    <polyline points="17 10 15 12 17 14"/>
    <polyline points="21 10 23 12 21 14"/>
    <line x1="18.5" y1="9" x2="19.5" y2="15"/>
  </svg>`,
  color: '#7E57C2',
  category: 'convert',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.svg,.gif,.avif,.heic,.heif',
  multiple: false,
  options: [
    {
      id: 'format',
      label: 'Output Format',
      type: 'select',
      options: [
        { value: 'dataurl', label: 'Data URL (img src="...")' },
        { value: 'css', label: 'CSS background-image' },
        { value: 'raw', label: 'Raw Base64 only' },
      ],
      defaultValue: 'dataurl',
    },
  ],
};

export default imageToBase64;
