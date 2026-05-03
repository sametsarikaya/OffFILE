import type { Tool } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const THUMB_LONG = 160;

async function renderThumbs(file: File): Promise<{ dataUrl: string; pageNum: number }[]> {
  const buffer = await file.arrayBuffer();
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
  const total  = pdf.numPages;
  const result: { dataUrl: string; pageNum: number }[] = [];

  for (let i = 1; i <= total; i++) {
    const page     = await pdf.getPage(i);
    const vp       = page.getViewport({ scale: 1 });
    const scale    = THUMB_LONG / Math.max(vp.width, vp.height);
    const viewport = page.getViewport({ scale });
    const canvas   = document.createElement('canvas');
    canvas.width   = Math.round(viewport.width);
    canvas.height  = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D, viewport }).promise;
    result.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.80), pageNum: i });
    canvas.width = 0; canvas.height = 0;
  }
  return result;
}

const pdfToImage: Tool = {
  id: 'pdf-to-image',
  title: 'PDF to Image',
  description: 'Convert PDF pages to PNG or JPEG images. Select pages via thumbnails.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="9" height="13" rx="1"/>
    <line x1="11" y1="9" x2="13" y2="9"/>
    <polyline points="12 7 14 9 12 11"/>
    <rect x="14" y="5" width="8" height="11" rx="1"/>
    <circle cx="17" cy="9" r="1"/>
    <path d="M14 16l2.5-3 2 2 2-2.5 1.5 3.5"/>
  </svg>`,
  color: '#6A1B9A',
  category: 'convert',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'format',
      label: 'Output format',
      type: 'select',
      options: [
        { value: 'image/png',  label: 'PNG (lossless)' },
        { value: 'image/jpeg', label: 'JPEG (smaller)' },
      ],
      defaultValue: 'image/png',
    },
  ],

  async renderInteractivePanel(files, options): Promise<HTMLElement> {
    const file = files[0];
    if (!file) return document.createElement('div');

    const wrap = document.createElement('div');
    wrap.className = 'reorder-panel';

    const loading = document.createElement('div');
    loading.className = 'reorder-loading';
    loading.innerHTML = `<span class="process-btn__spinner" aria-hidden="true"></span><span>Rendering page thumbnails...</span>`;
    wrap.appendChild(loading);
    wrap.dataset.loading = 'true';

    const thumbs = await renderThumbs(file);
    const total  = thumbs.length;
    wrap.dataset.loading = 'false';
    wrap.dispatchEvent(new CustomEvent('panel-ready', { bubbles: true }));
    loading.remove();

    // Default: all pages selected
    const selected = new Set<number>(thumbs.map((t) => t.pageNum));

    let counterEl: HTMLElement;

    const syncPages = () => {
      const sorted = [...selected].sort((a, b) => a - b);
      options.pages = sorted.length > 0 ? sorted.join(',') : '';
      if (selected.size === 0) {
        counterEl.textContent = '⚠ Select at least one page';
        counterEl.style.color = 'var(--clr-danger, #f44336)';
      } else {
        counterEl.textContent = `${selected.size} of ${total} pages selected`;
        counterEl.style.color = '';
      }
    };

    // Format row
    const fmtRow = document.createElement('div');
    fmtRow.className = 'split-mode-row';
    const fmtLabel = document.createElement('label');
    fmtLabel.className = 'option-group__label';
    fmtLabel.htmlFor = 'pti-format';
    fmtLabel.textContent = 'Output format:';
    const fmtSelect = document.createElement('select');
    fmtSelect.id = 'pti-format';
    fmtSelect.className = 'option-group__select';
    [['image/png', 'PNG (lossless)'], ['image/jpeg', 'JPEG (smaller)']].forEach(([v, l]) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = l;
      if (v === String(options.format ?? 'image/png')) opt.selected = true;
      fmtSelect.appendChild(opt);
    });
    fmtSelect.addEventListener('change', () => { options.format = fmtSelect.value; });
    fmtRow.appendChild(fmtLabel);
    fmtRow.appendChild(fmtSelect);
    wrap.appendChild(fmtRow);

    // Header with page counter
    const hdr = document.createElement('div');
    hdr.className = 'reorder-header';
    counterEl = document.createElement('span');
    counterEl.className = 'reorder-header__count';
    hdr.innerHTML = `<span class="reorder-header__title">Click pages to select / deselect</span>`;
    hdr.appendChild(counterEl);
    wrap.appendChild(hdr);

    // Thumbnail grid
    const grid = document.createElement('div');
    grid.className = 'reorder-grid';
    wrap.appendChild(grid);

    const buildGrid = () => {
      grid.innerHTML = '';
      thumbs.forEach(({ dataUrl, pageNum }) => {
        const item = document.createElement('div');
        item.className = 'reorder-item split-item';
        if (selected.has(pageNum)) item.classList.add('split-item--selected');
        item.setAttribute('aria-label', `Page ${pageNum}`);
        item.setAttribute('aria-pressed', String(selected.has(pageNum)));
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');

        const img = document.createElement('img');
        img.className = 'reorder-thumb';
        img.src = dataUrl;
        img.alt = `Page ${pageNum}`;
        img.draggable = false;

        const label = document.createElement('div');
        label.className = 'reorder-label';
        label.textContent = `Page ${pageNum}`;

        const checkmark = document.createElement('span');
        checkmark.className = 'split-item__check';
        checkmark.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

        item.appendChild(checkmark);
        item.appendChild(img);
        item.appendChild(label);

        const toggle = () => {
          if (selected.has(pageNum)) selected.delete(pageNum);
          else selected.add(pageNum);
          item.classList.toggle('split-item--selected', selected.has(pageNum));
          item.setAttribute('aria-pressed', String(selected.has(pageNum)));
          syncPages();
        };
        item.addEventListener('click', toggle);
        item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

        grid.appendChild(item);
      });
    };

    buildGrid();
    syncPages();

    // Action buttons
    const actRow = document.createElement('div');
    actRow.className = 'split-actions';

    const selAllBtn = document.createElement('button');
    selAllBtn.type = 'button'; selAllBtn.className = 'reorder-reset-btn';
    selAllBtn.textContent = 'Select All';
    selAllBtn.addEventListener('click', () => {
      thumbs.forEach(({ pageNum }) => selected.add(pageNum));
      buildGrid(); syncPages();
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button'; clearBtn.className = 'reorder-reset-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      selected.clear(); buildGrid(); syncPages();
    });

    actRow.appendChild(selAllBtn);
    actRow.appendChild(clearBtn);
    wrap.appendChild(actRow);

    return wrap;
  },
};

export default pdfToImage;
