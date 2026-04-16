import type { Tool } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const THUMB_LONG = 160;

async function renderSplitThumbs(file: File): Promise<{ dataUrl: string; pageNum: number }[]> {
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

const splitPdf: Tool = {
  id: 'split-pdf',
  title: 'Split PDF',
  description: 'Click page thumbnails to select pages, then extract.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <path d="m9 15 3 3 3-3"/>
  </svg>`,
  color: '#E91E63',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'pages',
      label: 'Pages to extract (auto-filled by thumbnail selection)',
      type: 'text',
      defaultValue: '1',
      placeholder: 'e.g. 1-3, 5, 8-10',
    },
    {
      id: 'mode',
      label: 'Output Mode',
      type: 'select',
      options: [
        { value: 'combined',   label: 'Combined PDF (all selected pages in one file)' },
        { value: 'individual', label: 'Individual PDFs (one per page, ZIP)' },
      ],
      defaultValue: 'combined',
    },
  ],

  async renderInteractivePanel(files, options): Promise<HTMLElement> {
    const file = files[0];
    if (!file) return document.createElement('div');

    const wrap = document.createElement('div');
    wrap.className = 'reorder-panel';

    // Loading state
    const loading = document.createElement('div');
    loading.className = 'reorder-loading';
    loading.innerHTML = `<span class="process-btn__spinner" aria-hidden="true"></span><span>Rendering page thumbnails...</span>`;
    wrap.appendChild(loading);
    wrap.dataset.loading = 'true';

    const thumbs = await renderSplitThumbs(file);
    const total  = thumbs.length;
    wrap.dataset.loading = 'false';
    wrap.dispatchEvent(new CustomEvent('panel-ready', { bubbles: true }));
    loading.remove();

    // Track selected pages (1-based)
    const selected = new Set<number>();
    // Pre-select from existing options.pages
    String(options.pages ?? '1').split(',').forEach((part) => {
      const trimmed = part.trim();
      const range = trimmed.match(/^(\d+)-(\d+)$/);
      if (range) {
        for (let p = Number(range[1]); p <= Number(range[2]); p++) selected.add(p);
      } else if (/^\d+$/.test(trimmed)) {
        selected.add(Number(trimmed));
      }
    });

    const syncPages = () => {
      const sorted = [...selected].sort((a, b) => a - b);
      options.pages = sorted.join(',');
      counterEl.textContent = selected.size > 0
        ? `${selected.size} of ${total} pages selected`
        : 'Click pages to select';
    };

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'reorder-header';
    const counterEl = document.createElement('span');
    counterEl.className = 'reorder-header__count';
    hdr.innerHTML = `<span class="reorder-header__title">Click pages to select / deselect</span>`;
    hdr.appendChild(counterEl);
    wrap.appendChild(hdr);

    // Mode select (output mode stays as standard option but we show it here too)
    const modeWrap = document.createElement('div');
    modeWrap.className = 'split-mode-row';
    const modeLabel = document.createElement('label');
    modeLabel.className = 'option-group__label';
    modeLabel.htmlFor = 'split-mode';
    modeLabel.textContent = 'Output mode:';
    const modeSelect = document.createElement('select');
    modeSelect.id = 'split-mode';
    modeSelect.className = 'option-group__select';
    [['combined', 'Combined PDF'], ['individual', 'Individual PDFs (ZIP)']].forEach(([v, l]) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = l;
      if (v === String(options.mode ?? 'combined')) opt.selected = true;
      modeSelect.appendChild(opt);
    });
    modeSelect.addEventListener('change', () => { options.mode = modeSelect.value; });
    modeWrap.appendChild(modeLabel);
    modeWrap.appendChild(modeSelect);
    wrap.appendChild(modeWrap);

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

    // Action buttons row
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

export default splitPdf;
