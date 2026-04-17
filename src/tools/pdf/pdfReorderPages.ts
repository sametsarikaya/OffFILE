import type { Tool } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const THUMB_LONG = 160; // px - longest dimension of thumbnail

/** Render all PDF pages as data URL strings (canvas cloneNode loses pixel data). */
async function renderPdfThumbs(file: File): Promise<{ dataUrl: string; pageNum: number }[]> {
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

    await page.render({
      canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D,
      viewport,
    }).promise;

    result.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.80), pageNum: i });
    // Allow GC on the canvas after conversion
    canvas.width = 0;
    canvas.height = 0;
  }

  return result;
}

const pdfReorderPages: Tool = {
  id: 'pdf-reorder-pages',
  title: 'Reorder PDF Pages',
  description: 'Drag page thumbnails to reorder, then process.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h13"/>
    <path d="M3 12h13"/>
    <path d="M3 18h9"/>
    <path d="M19 3l3 3-3 3"/>
    <path d="M19 21l3-3-3-3"/>
    <line x1="22" y1="6" x2="22" y2="18"/>
  </svg>`,
  color: '#0277BD',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
  options: [
    {
      id: 'order',
      label: 'Page order (auto-filled by drag UI)',
      type: 'text',
      defaultValue: '',
      placeholder: 'e.g. 3,1,2',
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
    loading.innerHTML = `
      <span class="process-btn__spinner" aria-hidden="true"></span>
      <span>Rendering page thumbnails...</span>
    `;
    wrap.appendChild(loading);

    // Signal the router that we're loading (process button stays disabled)
    wrap.dataset.loading = 'true';

    // Load and render thumbnails
    const thumbs = await renderPdfThumbs(file);
    const total  = thumbs.length;

    // Signal loading complete
    wrap.dataset.loading = 'false';
    wrap.dispatchEvent(new CustomEvent('panel-ready', { bubbles: true }));

    loading.remove();

    // Page order (1-based page numbers)
    let pageOrder: number[] = Array.from({ length: total }, (_, i) => i + 1);
    const syncOrder = () => { options.order = pageOrder.join(','); };
    syncOrder();

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'reorder-header';
    hdr.innerHTML = `
      <span class="reorder-header__title">Drag pages to reorder</span>
      <span class="reorder-header__count">${total} pages</span>
    `;
    wrap.appendChild(hdr);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'reorder-grid';
    wrap.appendChild(grid);

    let dragSrcIdx: number | null = null;

    const buildGrid = () => {
      grid.innerHTML = '';
      pageOrder.forEach((pageNum, idx) => {
        const thumb = thumbs.find((t) => t.pageNum === pageNum)!;

        const item = document.createElement('div');
        item.className = 'reorder-item';
        item.draggable = true;
        item.dataset.idx = String(idx);
        item.setAttribute('aria-label', `Page ${pageNum}, position ${idx + 1}`);

        // Use <img> with data URL - avoids canvas cloneNode pixel loss
        const img = document.createElement('img');
        img.className = 'reorder-thumb';
        img.src = thumb.dataUrl;
        img.alt = `Page ${pageNum} preview`;
        img.draggable = false;

        const label = document.createElement('div');
        label.className = 'reorder-label';
        label.textContent = `Page ${pageNum}`;

        const badge = document.createElement('span');
        badge.className = 'reorder-badge';
        badge.textContent = String(idx + 1);

        item.appendChild(img);
        item.appendChild(label);
        item.appendChild(badge);

        // Drag-and-drop
        item.addEventListener('dragstart', (e) => {
          dragSrcIdx = idx;
          item.classList.add('reorder-item--dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(idx));
          }
        });
        item.addEventListener('dragend', () => {
          item.classList.remove('reorder-item--dragging');
          grid.querySelectorAll('.reorder-item--drag-over').forEach((el) =>
            el.classList.remove('reorder-item--drag-over')
          );
        });
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          grid.querySelectorAll('.reorder-item--drag-over').forEach((el) =>
            el.classList.remove('reorder-item--drag-over')
          );
          item.classList.add('reorder-item--drag-over');
        });
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          if (dragSrcIdx === null || dragSrcIdx === idx) return;
          const moved = pageOrder.splice(dragSrcIdx, 1)[0];
          pageOrder.splice(idx, 0, moved);
          dragSrcIdx = null;
          syncOrder();
          buildGrid();
        });

        grid.appendChild(item);
      });
    };

    buildGrid();

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'reorder-reset-btn';
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset Order';
    resetBtn.addEventListener('click', () => {
      pageOrder = Array.from({ length: total }, (_, i) => i + 1);
      syncOrder();
      buildGrid();
    });
    wrap.appendChild(resetBtn);

    return wrap;
  },
};

export default pdfReorderPages;
