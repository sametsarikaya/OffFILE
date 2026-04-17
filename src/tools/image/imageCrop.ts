import type { Tool } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

const imageCrop: Tool = {
  id: 'image-crop',
  title: 'Crop Image',
  description: 'Visually crop your image - drag handles or use sliders.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
    <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
  </svg>`,
  color: '#00ACC1',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp',
  multiple: false,
  maxWarnBytes: 50 * 1024 * 1024,

  // options still used by the worker - values are kept in sync by renderInteractivePanel
  options: [
    { id: 'x', label: 'Left offset (%)', type: 'range', min: 0, max: 80, step: 1, defaultValue: 10 },
    { id: 'y', label: 'Top offset (%)',  type: 'range', min: 0, max: 80, step: 1, defaultValue: 10 },
    { id: 'w', label: 'Crop width (%)',  type: 'range', min: 10, max: 100, step: 1, defaultValue: 80 },
    { id: 'h', label: 'Crop height (%)', type: 'range', min: 10, max: 100, step: 1, defaultValue: 80 },
  ],

  async renderInteractivePanel(files, options): Promise<HTMLElement> {
    const file = files[0];
    if (!file) return document.createElement('div');

    const wrap = document.createElement('div');
    wrap.className = 'crop-panel';

    // Load image into object URL
    const imgUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('Could not load image'));
      el.src = imgUrl;
    });

    // ---- Canvas preview ----
    const previewWrap = document.createElement('div');
    previewWrap.className = 'crop-preview-wrap';

    const canvas = document.createElement('canvas');
    canvas.className = 'crop-canvas';
    previewWrap.appendChild(canvas);
    wrap.appendChild(previewWrap);

    // ---- Sliders ----
    const slidersWrap = document.createElement('div');
    slidersWrap.className = 'crop-sliders';

    type SliderDef = { id: string; label: string; min: number; max: number };
    const sliderDefs: SliderDef[] = [
      { id: 'x', label: 'Left offset (%)', min: 0, max: 80 },
      { id: 'y', label: 'Top offset (%)',  min: 0, max: 80 },
      { id: 'w', label: 'Crop width (%)',  min: 10, max: 100 },
      { id: 'h', label: 'Crop height (%)', min: 10, max: 100 },
    ];

    const sliderEls: Record<string, HTMLInputElement> = {};

    sliderDefs.forEach(({ id, label, min, max }) => {
      const group = document.createElement('div');
      group.className = 'crop-slider-group';

      const row = document.createElement('div');
      row.className = 'crop-slider-row';

      const lbl = document.createElement('label');
      lbl.className = 'option-group__label';
      lbl.htmlFor = `crop-${escapeHtml(id)}`;
      lbl.textContent = label;

      const badge = document.createElement('span');
      badge.className = 'option-group__value';
      badge.id = `crop-${escapeHtml(id)}-val`;
      badge.textContent = `${options[id] ?? (id === 'x' || id === 'y' ? 10 : 80)}%`;

      row.appendChild(lbl);
      row.appendChild(badge);

      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'option-group__range';
      input.id = `crop-${escapeHtml(id)}`;
      input.min = String(min);
      input.max = String(max);
      input.step = '1';
      input.value = String(options[id] ?? (id === 'x' || id === 'y' ? 10 : 80));

      sliderEls[id] = input;
      group.appendChild(row);
      group.appendChild(input);
      slidersWrap.appendChild(group);
    });

    // ---- Aspect ratio lock ----
    let lockRatio = false;
    // Ratio = crop_w_pct / crop_h_pct (in percentage space)
    let ratio = Number(options.w ?? 80) / Number(options.h ?? 80);

    const lockWrap = document.createElement('div');
    lockWrap.className = 'crop-lock-row';

    const lockLabel = document.createElement('label');
    lockLabel.className = 'crop-lock-label';
    lockLabel.htmlFor = 'crop-lock';

    const lockCb = document.createElement('input');
    lockCb.type = 'checkbox';
    lockCb.id = 'crop-lock';
    lockCb.className = 'crop-lock-checkbox';
    lockCb.checked = false;

    lockCb.addEventListener('change', () => {
      lockRatio = lockCb.checked;
      if (lockRatio) {
        ratio = Number(options.w ?? 80) / Number(options.h ?? 80);
      }
    });

    lockLabel.appendChild(lockCb);
    lockLabel.insertAdjacentText('beforeend', ' Lock aspect ratio');
    lockWrap.appendChild(lockLabel);
    wrap.appendChild(slidersWrap);
    wrap.appendChild(lockWrap);

    // ---- Draw function ----
    const draw = () => {
      const x = Number(options.x ?? 10);
      const y = Number(options.y ?? 10);
      const w = Number(options.w ?? 80);
      const h = Number(options.h ?? 80);

      const maxW = Math.min(previewWrap.clientWidth || 600, 700);
      const scale = maxW / img.naturalWidth;
      canvas.width  = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Darken outside crop area
      const cx = Math.round(canvas.width  * x / 100);
      const cy = Math.round(canvas.height * y / 100);
      const cw = Math.round(canvas.width  * Math.min(w, 100 - x) / 100);
      const ch = Math.round(canvas.height * Math.min(h, 100 - y) / 100);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(cx, cy, cw, ch);
      // Re-draw the crop area on top of the darkened image
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, cw, ch);
      ctx.clip();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Crop border
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, ch);

      // Corner handles
      const hSize = 10;
      ctx.fillStyle = '#ffe600';
      [[cx, cy], [cx + cw - hSize, cy], [cx, cy + ch - hSize], [cx + cw - hSize, cy + ch - hSize]].forEach(([hx, hy]) => {
        ctx.fillRect(hx, hy, hSize, hSize);
      });

      // Size label
      const pxW = Math.round(img.naturalWidth  * Math.min(w, 100 - x) / 100);
      const pxH = Math.round(img.naturalHeight * Math.min(h, 100 - y) / 100);
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${pxW} × ${pxH} px`, cx + 6, cy + 18);
    };

    // Wire sliders with aspect-ratio-lock support
    const setSlider = (id: string, val: number) => {
      const clamped = Math.max(Number(sliderEls[id].min), Math.min(Number(sliderEls[id].max), val));
      sliderEls[id].value = String(clamped);
      options[id] = clamped;
      const badge = document.getElementById(`crop-${id}-val`);
      if (badge) badge.textContent = `${clamped}%`;
      return clamped;
    };

    sliderEls['x'].addEventListener('input', () => { setSlider('x', Number(sliderEls['x'].value)); draw(); });
    sliderEls['y'].addEventListener('input', () => { setSlider('y', Number(sliderEls['y'].value)); draw(); });

    sliderEls['w'].addEventListener('input', () => {
      const w = setSlider('w', Number(sliderEls['w'].value));
      if (lockRatio) setSlider('h', Math.round(w / ratio));
      draw();
    });

    sliderEls['h'].addEventListener('input', () => {
      const h = setSlider('h', Number(sliderEls['h'].value));
      if (lockRatio) setSlider('w', Math.round(h * ratio));
      draw();
    });

    // Initial draw after layout - use rAF twice to ensure element is in DOM with real dimensions
    const imgUrl2 = URL.createObjectURL(file);
    const imgForDraw = new Image();
    imgForDraw.onload = () => {
      URL.revokeObjectURL(imgUrl2);
      requestAnimationFrame(() => requestAnimationFrame(() => { draw(); }));
    };
    imgForDraw.src = imgUrl2;

    return wrap;
  },
};

export default imageCrop;
