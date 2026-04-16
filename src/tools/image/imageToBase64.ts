import type { Tool } from '../../types';

const imageToBase64: Tool = {
  id: 'image-to-base64',
  title: 'Image to Base64',
  description: 'Convert images to Base64 encoded text for use in HTML or CSS.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
  </svg>`,
  color: '#7E57C2',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.svg,.gif',
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

  async process(files, options, onProgress) {
    const file = files[0];
    const format = (options.format as string) || 'dataurl';
    onProgress(20);

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    onProgress(50);

    // Convert to base64
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    const b64 = btoa(binary);
    const mimeType = file.type || 'image/png';
    onProgress(75);

    let output = '';
    if (format === 'dataurl') {
      output = `data:${mimeType};base64,${b64}`;
    } else if (format === 'css') {
      output = `background-image: url("data:${mimeType};base64,${b64}");`;
    } else {
      output = b64;
    }

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    onProgress(100);

    const baseName = file.name.replace(/\.[^.]+$/, '');
    return { blob, filename: `${baseName}_base64.txt` };
  },
};

export default imageToBase64;
