import type { Tool } from '../../types';

const compressPdf: Tool = {
  id: 'compress-pdf',
  title: 'Compress PDF',
  description: 'Reduce PDF file size by re-rendering pages at lower quality.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="m8 17 2-2 2 2 2-2 2 2"/>
    <polyline points="7 10 12 15 17 10"/>
  </svg>`,
  color: '#43A047',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'quality',
      label: 'Page Render Quality',
      type: 'select',
      options: [
        { value: 'low', label: 'Low (smallest file)' },
        { value: 'medium', label: 'Medium (balanced)' },
        { value: 'high', label: 'High (best quality)' },
      ],
      defaultValue: 'medium',
    },
  ],

  async process(files, options, onProgress) {
    const file = files[0];
    const quality = (options.quality as string) || 'medium';
    onProgress(10);

    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    onProgress(15);

    const scaleMap: Record<string, number> = { low: 1.0, medium: 1.5, high: 2.0 };
    const jpegQualityMap: Record<string, number> = { low: 0.5, medium: 0.7, high: 0.85 };
    const scale = scaleMap[quality];
    const jpegQ = jpegQualityMap[quality];

    const { jsPDF } = await import('jspdf');

    let doc: InstanceType<typeof jsPDF> | null = null;

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvas, viewport } as any).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', jpegQ);
      const wMM = (viewport.width * 25.4) / 96;
      const hMM = (viewport.height * 25.4) / 96;

      if (i === 1) {
        doc = new jsPDF({
          orientation: wMM > hMM ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [wMM, hMM],
        });
      } else {
        doc!.addPage([wMM, hMM], wMM > hMM ? 'landscape' : 'portrait');
      }

      doc!.addImage(dataUrl, 'JPEG', 0, 0, wMM, hMM);
      onProgress(15 + (i / totalPages) * 80);
    }

    const blob = doc!.output('blob');
    onProgress(100);

    const baseName = file.name.replace(/\.pdf$/i, '');
    return { blob, filename: `${baseName}_compressed.pdf` };
  },
};

export default compressPdf;
