import type { Tool } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

const imageCollage: Tool = {
  id: 'image-collage',
  title: 'Image Collage',
  description: 'Arrange multiple images into a grid and export as a single PNG.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
  </svg>`,
  color: '#8E24AA',
  category: 'image',
  acceptedTypes: '.jpg,.jpeg,.png,.webp,.gif',
  multiple: true,
  maxWarnBytes: 50 * 1024 * 1024,
  options: [
    {
      id: 'columns',
      label: 'Columns',
      type: 'number',
      min: 1,
      max: 8,
      defaultValue: 2,
    },
    {
      id: 'gap',
      label: 'Gap (px)',
      type: 'number',
      min: 0,
      max: 64,
      defaultValue: 8,
    },
    {
      id: 'cellSize',
      label: 'Cell size (px)',
      type: 'number',
      min: 64,
      max: 1200,
      defaultValue: 400,
    },
    {
      id: 'fitMode',
      label: 'Image Fit',
      type: 'select',
      options: [
        { value: 'cover',   label: 'Fill cell (crop to fit)' },
        { value: 'contain', label: 'Fit inside cell (letterbox)' },
      ],
      defaultValue: 'cover',
    },
    {
      id: 'background',
      label: 'Background',
      type: 'select',
      options: [
        { value: '#ffffff',     label: 'White' },
        { value: '#000000',     label: 'Black' },
        { value: '#f5f0de',     label: 'Cream' },
        { value: 'transparent', label: 'Transparent' },
      ],
      defaultValue: '#ffffff',
    },
  ],

  async renderInteractivePanel(files, options): Promise<HTMLElement> {
    if (!files.length) return document.createElement('div');

    const wrap = document.createElement('div');
    wrap.className = 'preview-panel';

    // Load all images up-front
    const imgs = await Promise.all(files.map((f) => new Promise<HTMLImageElement>((res, rej) => {
      const url = URL.createObjectURL(f);
      const el  = new Image();
      el.onload  = () => { URL.revokeObjectURL(url); res(el); };
      el.onerror = () => { URL.revokeObjectURL(url); rej(new Error('load error')); };
      el.src = url;
    })));

    // Preview canvas
    const previewWrap = document.createElement('div');
    previewWrap.className = 'preview-panel__canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.className = 'preview-panel__canvas';
    previewWrap.appendChild(canvas);
    wrap.appendChild(previewWrap);

    // Controls row
    const controls = document.createElement('div');
    controls.className = 'preview-panel__controls';

    const makeNumberInput = (id: string, label: string, min: number, max: number, step: number, defaultVal: number) => {
      const group = document.createElement('div');
      group.className = 'preview-panel__control-group';
      const lbl = document.createElement('label');
      lbl.className = 'option-group__label';
      lbl.htmlFor = `coll-${escapeHtml(id)}`;
      lbl.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'number'; inp.id = `coll-${id}`;
      inp.className = 'option-group__number';
      inp.min = String(min); inp.max = String(max); inp.step = String(step);
      inp.value = String(options[id] ?? defaultVal);
      inp.addEventListener('input', () => { options[id] = Number(inp.value); draw(); });
      group.appendChild(lbl); group.appendChild(inp);
      return group;
    };

    controls.appendChild(makeNumberInput('columns', 'Columns', 1, 8, 1, 2));
    controls.appendChild(makeNumberInput('gap', 'Gap (px)', 0, 64, 1, 8));
    controls.appendChild(makeNumberInput('cellSize', 'Cell size (px)', 64, 1200, 8, 400));

    const fitGroup = document.createElement('div');
    fitGroup.className = 'preview-panel__control-group';
    const fitLabel = document.createElement('label');
    fitLabel.className = 'option-group__label'; fitLabel.htmlFor = 'coll-fit';
    fitLabel.textContent = 'Image Fit';
    const fitSelect = document.createElement('select');
    fitSelect.id = 'coll-fit'; fitSelect.className = 'option-group__select';
    [['cover', 'Fill cell (crop to fit)'], ['contain', 'Fit inside (letterbox)']].forEach(([v, l]) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = l;
      if (v === String(options.fitMode ?? 'cover')) opt.selected = true;
      fitSelect.appendChild(opt);
    });
    fitSelect.addEventListener('change', () => { options.fitMode = fitSelect.value; draw(); });
    fitGroup.appendChild(fitLabel); fitGroup.appendChild(fitSelect);
    controls.appendChild(fitGroup);

    const bgGroup = document.createElement('div');
    bgGroup.className = 'preview-panel__control-group';
    const bgLabel = document.createElement('label');
    bgLabel.className = 'option-group__label'; bgLabel.htmlFor = 'coll-bg';
    bgLabel.textContent = 'Background';
    const bgSelect = document.createElement('select');
    bgSelect.id = 'coll-bg'; bgSelect.className = 'option-group__select';
    [['#ffffff', 'White'], ['#000000', 'Black'], ['#f5f0de', 'Cream'], ['transparent', 'Transparent']].forEach(([v, l]) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = l;
      if (v === String(options.background ?? '#ffffff')) opt.selected = true;
      bgSelect.appendChild(opt);
    });
    bgSelect.addEventListener('change', () => { options.background = bgSelect.value; draw(); });
    bgGroup.appendChild(bgLabel); bgGroup.appendChild(bgSelect);
    controls.appendChild(bgGroup);

    wrap.appendChild(controls);

    // Draw a scaled-down preview that mirrors worker logic
    const draw = () => {
      const columns  = Math.max(1, Math.min(8, Number(options.columns ?? 2)));
      const gap      = Math.max(0, Number(options.gap ?? 8));
      const cellSize = Math.max(64, Number(options.cellSize ?? 400));
      const bg       = String(options.background ?? '#ffffff');
      const fitMode  = String(options.fitMode ?? 'cover');

      const cols = Math.min(columns, imgs.length);
      const rows = Math.ceil(imgs.length / cols);

      // Scale down for preview (target max ~500px wide)
      const fullW   = cols * cellSize + (cols - 1) * gap;
      const fullH   = rows * cellSize + (rows - 1) * gap;
      const maxPx   = Math.min(previewWrap.clientWidth || 500, 500);
      const scale   = Math.min(1, maxPx / fullW);
      const pCell   = Math.round(cellSize * scale);
      const pGap    = Math.round(gap * scale);

      canvas.width  = cols * pCell + (cols - 1) * pGap;
      canvas.height = rows * pCell + (rows - 1) * pGap;

      const ctx = canvas.getContext('2d')!;
      if (bg !== 'transparent') {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // Checkerboard to indicate transparency
        const s = 8;
        for (let y = 0; y < canvas.height; y += s) {
          for (let x = 0; x < canvas.width; x += s) {
            ctx.fillStyle = ((x / s + y / s) % 2 === 0) ? '#ccc' : '#fff';
            ctx.fillRect(x, y, s, s);
          }
        }
      }

      imgs.forEach((img, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x   = col * (pCell + pGap);
        const y   = row * (pCell + pGap);

        let dw: number, dh: number, dx: number, dy: number;
        if (fitMode === 'contain') {
          const s2 = Math.min(pCell / img.naturalWidth, pCell / img.naturalHeight);
          dw = img.naturalWidth * s2; dh = img.naturalHeight * s2;
          dx = x + (pCell - dw) / 2; dy = y + (pCell - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
        } else {
          const s2 = Math.max(pCell / img.naturalWidth, pCell / img.naturalHeight);
          dw = img.naturalWidth * s2; dh = img.naturalHeight * s2;
          dx = x + (pCell - dw) / 2; dy = y + (pCell - dh) / 2;
          ctx.save();
          ctx.beginPath(); ctx.rect(x, y, pCell, pCell); ctx.clip();
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
        }
      });

      // Show final dimensions as overlay
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${fullW} × ${fullH} px`, 6, canvas.height - 6);
    };

    requestAnimationFrame(() => draw());
    return wrap;
  },
};

export default imageCollage;
