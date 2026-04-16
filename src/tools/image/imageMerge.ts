import type { Tool } from '../../types';

const THUMB_SIZE = 120; // px - thumbnail longest edge

const imageMerge: Tool = {
  id: 'image-merge',
  title: 'Merge / Stack Images',
  description: 'Combine multiple images into one - side by side or stacked vertically.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="9" height="16" rx="1"/>
    <rect x="13" y="4" width="9" height="16" rx="1"/>
  </svg>`,
  color: '#5C6BC0',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp',
  multiple: true,
  options: [
    {
      id: 'direction',
      label: 'Layout',
      type: 'select',
      options: [
        { value: 'horizontal', label: 'Side by side' },
        { value: 'vertical',   label: 'Stack vertically' },
      ],
      defaultValue: 'horizontal',
    },
    {
      id: 'align',
      label: 'Alignment',
      type: 'select',
      options: [
        { value: 'start',  label: 'Top / Left' },
        { value: 'center', label: 'Center' },
        { value: 'end',    label: 'Bottom / Right' },
      ],
      defaultValue: 'center',
    },
    {
      id: 'gap',
      label: 'Gap (px)',
      type: 'number',
      min: 0,
      max: 200,
      step: 4,
      defaultValue: 0,
    },
    {
      id: 'background',
      label: 'Gap / fill color',
      type: 'text',
      defaultValue: '#ffffff',
      placeholder: '#ffffff or transparent',
    },
  ],

  async renderInteractivePanel(files, options): Promise<HTMLElement> {
    if (files.length === 0) return document.createElement('div');

    const wrap = document.createElement('div');
    wrap.className = 'reorder-panel';

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'reorder-header';
    hdr.innerHTML = `
      <span class="reorder-header__title">Drag images to reorder</span>
      <span class="reorder-header__count">${files.length} images</span>
    `;
    wrap.appendChild(hdr);

    // Snapshot original order before any drag-and-drop mutations
    const originalFiles = [...files];

    // Render a thumbnail data URL for each file
    const thumbUrls: string[] = await Promise.all(files.map((f) => new Promise<string>((res) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const scale = THUMB_SIZE / Math.max(img.naturalWidth, img.naturalHeight);
        const c = document.createElement('canvas');
        c.width  = Math.round(img.naturalWidth  * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.75));
        URL.revokeObjectURL(url);
        c.width = 0; c.height = 0;
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(''); };
      img.src = url;
    })));

    const grid = document.createElement('div');
    grid.className = 'reorder-grid';
    wrap.appendChild(grid);

    let dragSrcIdx: number | null = null;
    // order[pos] = index into originalFiles - thumbUrls uses the same indexing
    let order: number[] = originalFiles.map((_, i) => i);

    const syncFiles = () => {
      files.splice(0, files.length, ...order.map((i) => originalFiles[i]));
    };

    const buildGrid = () => {
      grid.innerHTML = '';
      order.forEach((origIdx, pos) => {
        const item = document.createElement('div');
        item.className = 'reorder-item';
        item.draggable = true;
        item.dataset.pos = String(pos);
        item.setAttribute('aria-label', `Image ${origIdx + 1}, position ${pos + 1}`);

        const img = document.createElement('img');
        img.className = 'reorder-thumb';
        img.src = thumbUrls[origIdx];
        img.alt = originalFiles[origIdx].name;
        img.draggable = false;

        const label = document.createElement('div');
        label.className = 'reorder-label';
        const name = originalFiles[origIdx].name;
        label.textContent = name.length > 16 ? name.slice(0, 14) + '...' : name;

        const badge = document.createElement('span');
        badge.className = 'reorder-badge';
        badge.textContent = String(pos + 1);

        item.appendChild(img);
        item.appendChild(label);
        item.appendChild(badge);

        item.addEventListener('dragstart', (e) => {
          dragSrcIdx = pos;
          item.classList.add('reorder-item--dragging');
          if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(pos)); }
        });
        item.addEventListener('dragend', () => {
          item.classList.remove('reorder-item--dragging');
          grid.querySelectorAll('.reorder-item--drag-over').forEach((el) => el.classList.remove('reorder-item--drag-over'));
        });
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          grid.querySelectorAll('.reorder-item--drag-over').forEach((el) => el.classList.remove('reorder-item--drag-over'));
          item.classList.add('reorder-item--drag-over');
        });
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          if (dragSrcIdx === null || dragSrcIdx === pos) return;
          const moved = order.splice(dragSrcIdx, 1)[0];
          order.splice(pos, 0, moved);
          dragSrcIdx = null;
          syncFiles();
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
      order = originalFiles.map((_, i) => i);
      syncFiles();
      buildGrid();
    });
    wrap.appendChild(resetBtn);

    return wrap;
  },
};

export default imageMerge;
