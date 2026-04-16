import type { DropZoneConfig } from '../types';
import { isFileTypeAllowed } from '../utils/mimeTypes';
import { escapeHtml } from '../utils/escapeHtml';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createSizeWarning(fileNames: string[], limitBytes: number): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'size-warning';
  bar.id = 'size-warning';

  const limitLabel = formatFileSize(limitBytes);
  const names = fileNames.map(escapeHtml).join(', ');

  bar.innerHTML = `
    <div class="size-warning__inner">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>The recommended limit (${limitLabel}) was exceeded for <strong>${names}</strong>. Processing may be slower or fail on low-memory devices.</span>
      <button class="size-warning__dismiss" type="button" aria-label="Dismiss warning">×</button>
    </div>
  `;

  bar.querySelector('.size-warning__dismiss')!.addEventListener('click', () => bar.remove());
  return bar;
}

function checkSizeWarning(
  files: File[], maxWarnBytes: number, container: HTMLElement
): void {
  const oversized = files.filter((f) => f.size > maxWarnBytes).map((f) => f.name);
  if (!oversized.length) return;
  const existing = container.querySelector('#size-warning');
  if (existing) existing.remove();
  container.insertBefore(createSizeWarning(oversized, maxWarnBytes), container.firstChild);
}

export function createDropZone(config: DropZoneConfig): HTMLElement {
  const { acceptedTypes, multiple, onFiles, color, maxWarnBytes } = config;

  const zone = document.createElement('div');
  zone.className = 'dropzone';
  zone.id = 'drop-zone';
  zone.style.setProperty('--dz-color', color);
  zone.setAttribute('tabindex', '0');
  zone.setAttribute('role', 'button');
  zone.setAttribute('aria-label', 'Upload file - drag and drop or click to browse');

  const accepts = acceptedTypes.split(',').map((s) => s.trim()).join(', ');

  zone.innerHTML = `
    <div class="dropzone__body">
      <div class="dropzone__icon">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <p class="dropzone__title">Drop files here</p>
      <p class="dropzone__subtitle">or</p>
      <button class="dropzone__btn" id="dz-browse-btn" type="button">Choose Files</button>
      <p class="dropzone__accepts">${accepts}</p>
    </div>
    <input type="file" class="dropzone__input" id="dz-file-input"
      accept="${acceptedTypes}" ${multiple ? 'multiple' : ''} />
    <div class="dropzone__overlay" id="dz-overlay">
      <div class="dropzone__overlay-text">Drop to upload</div>
    </div>
  `;

  const input     = zone.querySelector('#dz-file-input')   as HTMLInputElement;
  const browseBtn = zone.querySelector('#dz-browse-btn')   as HTMLButtonElement;
  const overlay   = zone.querySelector('#dz-overlay')      as HTMLElement;

  /** Filter files by MIME type, show notification for rejected ones */
  function filterAndDeliver(raw: File[]): void {
    const allowed  = raw.filter((f) => isFileTypeAllowed(f, acceptedTypes));
    const rejected = raw.length - allowed.length;

    if (rejected > 0) {
      showTypeRejectedToast(rejected, zone);
    }

    if (!allowed.length) return;

    if (maxWarnBytes) {
      checkSizeWarning(allowed, maxWarnBytes, zone.closest('.work-area-wrapper') ?? document.body);
    }

    onFiles(allowed);
  }

  browseBtn.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  // Mobile touch: tap on the zone itself opens the file picker
  // (drag-and-drop is not available on mobile browsers)
  zone.addEventListener('touchend', (e: TouchEvent) => {
    // Only respond to a simple tap (not a scroll or multi-touch)
    if (e.changedTouches.length === 1 && e.target !== browseBtn) {
      e.preventDefault();
      input.click();
    }
  }, { passive: false });
  input.addEventListener('change', () => {
    if (input.files?.length) { filterAndDeliver(Array.from(input.files)); input.value = ''; }
  });

  // Page-level drag overlay
  let dragCounter = 0;
  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    if (++dragCounter === 1) {
      zone.classList.add('dropzone--active');
      zone.classList.add('dropzone--page-drag');
      overlay.style.display = 'flex';
    }
  };
  const onDragLeave = () => {
    if (--dragCounter <= 0) {
      dragCounter = 0;
      zone.classList.remove('dropzone--active');
      zone.classList.remove('dropzone--page-drag');
      overlay.style.display = 'none';
    }
  };
  const onDragOver = (e: DragEvent) => { e.preventDefault(); };
  const onDrop     = (e: DragEvent) => {
    e.preventDefault();
    dragCounter = 0;
    zone.classList.remove('dropzone--active');
    zone.classList.remove('dropzone--page-drag');
    overlay.style.display = 'none';
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) filterAndDeliver(files);
  };

  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('dragover',  onDragOver);
  document.addEventListener('drop',      onDrop);

  window.addEventListener('hashchange', () => {
    document.removeEventListener('dragenter', onDragEnter);
    document.removeEventListener('dragleave', onDragLeave);
    document.removeEventListener('dragover',  onDragOver);
    document.removeEventListener('drop',      onDrop);
  }, { once: true });

  return zone;
}

function showTypeRejectedToast(count: number, anchor: HTMLElement): void {
  const toast = document.createElement('div');
  toast.className = 'toast toast--error';
  toast.textContent = `${count} file(s) skipped: unsupported format.`;
  (anchor.ownerDocument.body ?? anchor).appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

export function createFileList(
  files: File[],
  onRemove: (index: number) => void,
  onReorder?: (newFiles: File[]) => void
): HTMLElement {
  const list = document.createElement('div');
  list.className = 'file-list';
  list.id = 'file-list';

  const header = document.createElement('div');
  header.className = 'file-list__header';
  header.innerHTML = `
    <span class="file-list__count">${files.length} file(s) selected</span>
    ${files.length > 1 ? '<span class="file-list__hint">Drag to reorder</span>' : ''}
  `;
  list.appendChild(header);

  const orderedFiles = [...files];
  let dragSrcIndex = -1;

  const renderItems = () => {
    list.querySelectorAll('.file-list__item').forEach((el) => el.remove());

    orderedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-list__item';
      item.setAttribute('draggable', orderedFiles.length > 1 ? 'true' : 'false');
      item.dataset.index = String(index);

      const ext     = escapeHtml(file.name.split('.').pop()?.toUpperCase() || '?');
      const safeName = escapeHtml(file.name);
      item.innerHTML = `
        <div class="file-list__item-drag" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="16" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="8" y1="18" x2="16" y2="18"/>
          </svg>
        </div>
        <div class="file-list__item-badge">${ext}</div>
        <div class="file-list__item-info">
          <span class="file-list__item-name">${safeName}</span>
          <span class="file-list__item-size">${formatFileSize(file.size)}</span>
        </div>
        <button class="file-list__item-remove" data-index="${index}" type="button" aria-label="Remove ${safeName}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;

      item.querySelector('.file-list__item-remove')!.addEventListener('click', (e) => {
        e.stopPropagation();
        onRemove(files.indexOf(orderedFiles[index]));
      });

      if (orderedFiles.length > 1 && onReorder) {
        item.addEventListener('dragstart', (e) => {
          dragSrcIndex = index;
          item.classList.add('is-dragging');
          e.dataTransfer!.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
          item.classList.remove('is-dragging');
          list.querySelectorAll('.file-list__item').forEach((el) => el.classList.remove('drag-over'));
        });
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer!.dropEffect = 'move';
          list.querySelectorAll('.file-list__item').forEach((el) => el.classList.remove('drag-over'));
          item.classList.add('drag-over');
        });
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragSrcIndex === index) return;
          const [moved] = orderedFiles.splice(dragSrcIndex, 1);
          orderedFiles.splice(index, 0, moved);
          dragSrcIndex = -1;
          onReorder([...orderedFiles]);
          renderItems();
        });
      }

      list.appendChild(item);
    });
  };

  renderItems();
  return list;
}
