import type { Tool } from '../../types';

const imageWatermark: Tool = {
  id: 'image-watermark',
  title: 'Image Watermark',
  description: 'Add a custom text watermark overlay to your images.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <path d="M3 15l5-5 4 4 3-3 4 4"/>
    <path d="M6.5 19.5l11-11"/>
    <path d="M6.5 16l8-8"/>
  </svg>`,
  color: '#FF7043',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp',
  multiple: false,
  options: [
    { id: 'text',    label: 'Watermark text', type: 'text',   defaultValue: 'CONFIDENTIAL', placeholder: 'e.g. DRAFT, SAMPLE' },
    { id: 'opacity', label: 'Opacity (%)',     type: 'range',  min: 5, max: 80, step: 5, defaultValue: 30 },
    { id: 'color',   label: 'Color',           type: 'select',
      options: [
        { value: '#888888', label: 'Gray (neutral)' },
        { value: '#ff0000', label: 'Red' },
        { value: '#0000ff', label: 'Blue' },
        { value: '#000000', label: 'Black' },
        { value: '#ffffff', label: 'White' },
      ],
      defaultValue: '#888888',
    },
  ],

  async renderInteractivePanel(files, options): Promise<HTMLElement> {
    const file = files[0];
    if (!file) return document.createElement('div');

    const wrap = document.createElement('div');
    wrap.className = 'preview-panel';

    // Load image
    const imgUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('Could not load image'));
      el.src = imgUrl;
    });
    URL.revokeObjectURL(imgUrl);

    // Canvas preview
    const previewWrap = document.createElement('div');
    previewWrap.className = 'preview-panel__canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.className = 'preview-panel__canvas';
    previewWrap.appendChild(canvas);
    wrap.appendChild(previewWrap);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'preview-panel__controls';

    // Text input
    const textGroup = document.createElement('div');
    textGroup.className = 'preview-panel__control-group preview-panel__control-group--full';
    const textLabel = document.createElement('label');
    textLabel.className = 'option-group__label';
    textLabel.htmlFor = 'wm-text';
    textLabel.textContent = 'Watermark text';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.id = 'wm-text';
    textInput.className = 'option-group__input';
    textInput.value = String(options.text ?? 'CONFIDENTIAL');
    textInput.placeholder = 'e.g. DRAFT, SAMPLE';
    textGroup.appendChild(textLabel);
    textGroup.appendChild(textInput);
    controls.appendChild(textGroup);

    // Opacity slider
    const opGroup = document.createElement('div');
    opGroup.className = 'preview-panel__control-group';
    const opRow = document.createElement('div');
    opRow.className = 'crop-slider-row';
    const opLabel = document.createElement('label');
    opLabel.className = 'option-group__label';
    opLabel.htmlFor = 'wm-opacity';
    opLabel.textContent = 'Opacity (%)';
    const opVal = document.createElement('span');
    opVal.className = 'option-group__value';
    opVal.textContent = `${options.opacity ?? 30}%`;
    opRow.appendChild(opLabel);
    opRow.appendChild(opVal);
    const opSlider = document.createElement('input');
    opSlider.type = 'range';
    opSlider.id = 'wm-opacity';
    opSlider.className = 'option-group__range';
    opSlider.min = '5'; opSlider.max = '80'; opSlider.step = '5';
    opSlider.value = String(options.opacity ?? 30);
    opGroup.appendChild(opRow);
    opGroup.appendChild(opSlider);
    controls.appendChild(opGroup);

    // Color select
    const colGroup = document.createElement('div');
    colGroup.className = 'preview-panel__control-group';
    const colLabel = document.createElement('label');
    colLabel.className = 'option-group__label';
    colLabel.htmlFor = 'wm-color';
    colLabel.textContent = 'Color';
    const colSelect = document.createElement('select');
    colSelect.id = 'wm-color';
    colSelect.className = 'option-group__select';
    [
      ['#888888', 'Gray (neutral)'], ['#ff0000', 'Red'],
      ['#0000ff', 'Blue'], ['#000000', 'Black'], ['#ffffff', 'White'],
    ].forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value; opt.textContent = label;
      if (value === String(options.color ?? '#888888')) opt.selected = true;
      colSelect.appendChild(opt);
    });
    colGroup.appendChild(colLabel);
    colGroup.appendChild(colSelect);
    controls.appendChild(colGroup);

    wrap.appendChild(controls);

    // Draw - mirrors worker logic exactly so preview matches output
    const draw = () => {
      const maxW = Math.min(previewWrap.clientWidth || 600, 700);
      const scale = maxW / img.naturalWidth;
      canvas.width  = Math.round(img.naturalWidth  * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const text    = (String(options.text ?? 'CONFIDENTIAL').trim()) || 'CONFIDENTIAL';
      const opacity = Number(options.opacity ?? 30) / 100;
      const color   = String(options.color ?? '#888888');
      const fontSize = Math.max(14, Math.min(canvas.width, canvas.height) / 12);
      const spacing  = fontSize * 5;

      ctx.save();
      ctx.globalAlpha  = opacity;
      ctx.fillStyle    = color;
      ctx.font         = `bold ${fontSize}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 4);
      for (let y = -canvas.height; y < canvas.height * 2; y += spacing) {
        for (let x = -canvas.width; x < canvas.width * 2; x += spacing) {
          ctx.fillText(text, x - canvas.width / 2, y - canvas.height / 2);
        }
      }
      ctx.restore();
    };

    textInput.addEventListener('input',  () => { options.text    = textInput.value;           draw(); });
    opSlider.addEventListener('input',   () => { options.opacity = Number(opSlider.value); opVal.textContent = `${opSlider.value}%`; draw(); });
    colSelect.addEventListener('change', () => { options.color   = colSelect.value;             draw(); });

    requestAnimationFrame(() => draw());
    return wrap;
  },
};

export default imageWatermark;
