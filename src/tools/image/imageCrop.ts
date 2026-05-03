import type { Tool } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

const imageCrop: Tool = {
  id: 'image-crop',
  title: 'Crop Image',
  description: 'Visually crop your image — drag directly on the canvas or use sliders.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
    <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
  </svg>`,
  color: '#00ACC1',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp,.avif,.heic,.heif',
  multiple: false,
  maxWarnBytes: 50 * 1024 * 1024,

  options: [
    { id: 'x', label: 'Left offset (%)', type: 'range', min: 0, max: 99, step: 1, defaultValue: 10 },
    { id: 'y', label: 'Top offset (%)',  type: 'range', min: 0, max: 99, step: 1, defaultValue: 10 },
    { id: 'w', label: 'Crop width (%)',  type: 'range', min: 1, max: 100, step: 1, defaultValue: 80 },
    { id: 'h', label: 'Crop height (%)', type: 'range', min: 1, max: 100, step: 1, defaultValue: 80 },
  ],

  async renderInteractivePanel(files, options): Promise<HTMLElement> {
    const file = files[0];
    if (!file) return document.createElement('div');

    const wrap = document.createElement('div');
    wrap.className = 'crop-panel';

    const imgUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => { URL.revokeObjectURL(imgUrl); res(el); };
      el.onerror = () => rej(new Error('Could not load image'));
      el.src = imgUrl;
    });

    // ---- Canvas ----
    const previewWrap = document.createElement('div');
    previewWrap.className = 'crop-preview-wrap';
    previewWrap.style.cursor = 'crosshair';

    const canvas = document.createElement('canvas');
    canvas.className = 'crop-canvas';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    previewWrap.appendChild(canvas);
    wrap.appendChild(previewWrap);

    // ---- Sliders ----
    const slidersWrap = document.createElement('div');
    slidersWrap.className = 'crop-sliders';

    type SliderDef = { id: string; label: string; min: number; max: number };
    const sliderDefs: SliderDef[] = [
      { id: 'x', label: 'Left offset (%)', min: 0, max: 99 },
      { id: 'y', label: 'Top offset (%)',  min: 0, max: 99 },
      { id: 'w', label: 'Crop width (%)',  min: 1, max: 100 },
      { id: 'h', label: 'Crop height (%)', min: 1, max: 100 },
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
    lockCb.addEventListener('change', () => {
      lockRatio = lockCb.checked;
      if (lockRatio) ratio = Number(options.w) / Number(options.h);
    });
    lockLabel.appendChild(lockCb);
    lockLabel.insertAdjacentText('beforeend', ' Lock aspect ratio');
    lockWrap.appendChild(lockLabel);
    wrap.appendChild(slidersWrap);
    wrap.appendChild(lockWrap);

    // ---- Shared state helpers ----
    const HANDLE = 10; // handle size in canvas px

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    /** Apply new sel values to options + sliders, then redraw */
    const applySelection = (x: number, y: number, w: number, h: number) => {
      // Clamp so selection stays inside image
      x = clamp(Math.round(x), 0, 99);
      y = clamp(Math.round(y), 0, 99);
      w = clamp(Math.round(w), 1, 100 - x);
      h = clamp(Math.round(h), 1, 100 - y);

      options.x = x; options.y = y; options.w = w; options.h = h;

      (['x', 'y', 'w', 'h'] as const).forEach((id) => {
        sliderEls[id].value = String(options[id]);
        const badge = document.getElementById(`crop-${id}-val`);
        if (badge) badge.textContent = `${options[id]}%`;
      });
    };

    // ---- Draw ----
    const draw = () => {
      const x = Number(options.x ?? 10);
      const y = Number(options.y ?? 10);
      const w = Number(options.w ?? 80);
      const h = Number(options.h ?? 80);

      const maxW = Math.min(previewWrap.clientWidth || 600, 700);
      const scale = maxW / img.naturalWidth;
      canvas.width  = Math.round(img.naturalWidth  * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const cx = Math.round(canvas.width  * x / 100);
      const cy = Math.round(canvas.height * y / 100);
      const cw = Math.round(canvas.width  * w / 100);
      const ch = Math.round(canvas.height * h / 100);

      // Darken outside
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, cw, ch);
      ctx.clip();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Border + rule-of-thirds grid
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx, cy, cw, ch);
      ctx.strokeStyle = 'rgba(255,230,0,0.3)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(cx + cw * i / 3, cy); ctx.lineTo(cx + cw * i / 3, cy + ch); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy + ch * i / 3); ctx.lineTo(cx + cw, cy + ch * i / 3); ctx.stroke();
      }

      // 8 handles (4 corners + 4 edge midpoints)
      ctx.fillStyle = '#ffe600';
      const handles = getHandleRects(cx, cy, cw, ch);
      handles.forEach(({ hx, hy }) => ctx.fillRect(hx, hy, HANDLE, HANDLE));

      // Size label
      const pxW = Math.round(img.naturalWidth  * w / 100);
      const pxH = Math.round(img.naturalHeight * h / 100);
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 12px monospace';
      const label = `${pxW} × ${pxH} px`;
      const labelY = cy > 22 ? cy - 6 : cy + ch + 16;
      ctx.fillText(label, cx + 4, labelY);
    };

    type HandleName = 'tl'|'tc'|'tr'|'ml'|'mr'|'bl'|'bc'|'br';
    interface HandleRect { name: HandleName; hx: number; hy: number; }

    const getHandleRects = (cx: number, cy: number, cw: number, ch: number): HandleRect[] => [
      { name: 'tl', hx: cx,               hy: cy               },
      { name: 'tc', hx: cx + cw/2 - HANDLE/2, hy: cy           },
      { name: 'tr', hx: cx + cw - HANDLE, hy: cy               },
      { name: 'ml', hx: cx,               hy: cy + ch/2 - HANDLE/2 },
      { name: 'mr', hx: cx + cw - HANDLE, hy: cy + ch/2 - HANDLE/2 },
      { name: 'bl', hx: cx,               hy: cy + ch - HANDLE  },
      { name: 'bc', hx: cx + cw/2 - HANDLE/2, hy: cy + ch - HANDLE },
      { name: 'br', hx: cx + cw - HANDLE, hy: cy + ch - HANDLE  },
    ];

    /** Returns canvas-space rect of current selection */
    const selRect = () => {
      const x = Number(options.x), y = Number(options.y);
      const w = Number(options.w), h = Number(options.h);
      return {
        cx: canvas.width  * x / 100,
        cy: canvas.height * y / 100,
        cw: canvas.width  * w / 100,
        ch: canvas.height * h / 100,
      };
    };

    /** Hit-test canvas point; returns handle name, 'move', 'new', or null */
    const hitTest = (px: number, py: number): HandleName | 'move' | 'new' => {
      const { cx, cy, cw, ch } = selRect();
      const handles = getHandleRects(cx, cy, cw, ch);
      const pad = 4; // extra hit area around handles
      for (const { name, hx, hy } of handles) {
        if (px >= hx - pad && px <= hx + HANDLE + pad && py >= hy - pad && py <= hy + HANDLE + pad)
          return name;
      }
      if (px >= cx && px <= cx + cw && py >= cy && py <= cy + ch) return 'move';
      return 'new';
    };

    const cursorForHit: Record<string, string> = {
      tl: 'nw-resize', tc: 'n-resize', tr: 'ne-resize',
      ml: 'w-resize',  mr: 'e-resize',
      bl: 'sw-resize', bc: 's-resize', br: 'se-resize',
      move: 'move', new: 'crosshair',
    };

    // ---- Drag state ----
    type DragMode = HandleName | 'move' | 'new' | null;
    let dragMode: DragMode = null;
    let dragStartPx = { x: 0, y: 0 };
    let dragStartSel = { x: 0, y: 0, w: 0, h: 0 };
    // For 'new' mode: anchor point in % space
    let anchorPct = { x: 0, y: 0 };

    const canvasPct = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      return {
        px: clamp(e.clientX - rect.left, 0, rect.width),
        py: clamp(e.clientY - rect.top,  0, rect.height),
        pctX: clamp((e.clientX - rect.left) / rect.width * 100,  0, 100),
        pctY: clamp((e.clientY - rect.top)  / rect.height * 100, 0, 100),
      };
    };

    const onDragStart = (px: number, py: number, pctX: number, pctY: number) => {
      dragMode = hitTest(px, py);
      dragStartPx  = { x: px, y: py };
      dragStartSel = { x: Number(options.x), y: Number(options.y), w: Number(options.w), h: Number(options.h) };
      anchorPct    = { x: pctX, y: pctY };
    };

    const onDragMove = (pctX: number, pctY: number) => {
      if (!dragMode) return;
      const { x: sx, y: sy, w: sw, h: sh } = dragStartSel;

      if (dragMode === 'new') {
        const ax = anchorPct.x, ay = anchorPct.y;
        const x = Math.min(ax, pctX), y = Math.min(ay, pctY);
        const w = Math.abs(pctX - ax), h = Math.abs(pctY - ay);
        applySelection(x, y, Math.max(1, w), Math.max(1, h));
        draw(); return;
      }

      if (dragMode === 'move') {
        const dx = pctX - anchorPct.x, dy = pctY - anchorPct.y;
        applySelection(sx + dx, sy + dy, sw, sh);
        draw(); return;
      }

      // Resize: compute new rect based on handle dragged
      let nx = sx, ny = sy, nw = sw, nh = sh;
      const dx = pctX - anchorPct.x, dy = pctY - anchorPct.y;

      if (dragMode === 'tl') { nx = sx + dx; ny = sy + dy; nw = sw - dx; nh = sh - dy; }
      if (dragMode === 'tc') { ny = sy + dy; nh = sh - dy; }
      if (dragMode === 'tr') { ny = sy + dy; nw = sw + dx; nh = sh - dy; }
      if (dragMode === 'ml') { nx = sx + dx; nw = sw - dx; }
      if (dragMode === 'mr') { nw = sw + dx; }
      if (dragMode === 'bl') { nx = sx + dx; nw = sw - dx; nh = sh + dy; }
      if (dragMode === 'bc') { nh = sh + dy; }
      if (dragMode === 'br') { nw = sw + dx; nh = sh + dy; }

      if (lockRatio) {
        if (['ml', 'mr'].includes(dragMode)) nh = nw / ratio;
        else if (['tc', 'bc'].includes(dragMode)) nw = nh * ratio;
        else nh = nw / ratio;
      }

      applySelection(nx, ny, nw, nh);
      draw();
    };

    // Mouse events
    canvas.addEventListener('mousemove', (e) => {
      if (!dragMode) {
        const hit = hitTest(e.offsetX, e.offsetY);
        canvas.style.cursor = cursorForHit[hit] ?? 'crosshair';
        return;
      }
      const { pctX, pctY } = canvasPct(e);
      onDragMove(pctX, pctY);
    });

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const { px, py, pctX, pctY } = canvasPct(e);
      onDragStart(px, py, pctX, pctY);
    });

    const onMouseUp = () => { dragMode = null; };
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const { px, py, pctX, pctY } = canvasPct(t);
      onDragStart(px, py, pctX, pctY);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const { pctX, pctY } = canvasPct(e.touches[0]);
      onDragMove(pctX, pctY);
    }, { passive: false });

    canvas.addEventListener('touchend', () => { dragMode = null; });

    // Wire sliders → sync options + draw
    const setSlider = (id: string, val: number) => {
      const clamped = clamp(Math.round(val), Number(sliderEls[id].min), Number(sliderEls[id].max));
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

    // Initial draw
    requestAnimationFrame(() => requestAnimationFrame(() => draw()));
    return wrap;
  },
};

export default imageCrop;
