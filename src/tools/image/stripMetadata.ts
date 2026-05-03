import type { Tool } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

/** Read basic image info (dimensions, type, last-modified) without a library. */
async function readImageInfo(file: File): Promise<{
  width: number;
  height: number;
  hasExifMarker: boolean;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Quick EXIF check: JPEG EXIF lives in APP1 (FFE1) marker
      // We read the first 12 bytes to detect it
      const reader = new FileReader();
      reader.onload = (e) => {
        const buf = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buf);
        // JPEG starts with FF D8, APP1 marker is FF E1
        const hasExifMarker =
          bytes[0] === 0xff &&
          bytes[1] === 0xd8 &&
          bytes.length > 4 &&
          bytes[2] === 0xff &&
          bytes[3] === 0xe1;
        resolve({ width: img.naturalWidth, height: img.naturalHeight, hasExifMarker });
      };
      reader.onerror = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, hasExifMarker: false });
      reader.readAsArrayBuffer(file.slice(0, 16));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0, hasExifMarker: false });
    };
    img.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const stripMetadata: Tool = {
  id: 'strip-metadata',
  title: 'Strip Metadata',
  description: 'Remove EXIF data, GPS location, and other metadata from images. Preview what will be removed first.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <path d="M3 15l5-5 4 4 3-3 4 4"/>
    <path d="M16 5l-7 7"/>
    <path d="M19 5l-7 7"/>
    <line x1="16" y1="19" x2="19" y2="19"/>
  </svg>`,
  color: '#546E7A',
  category: 'image',
  acceptedTypes: '.png,.jpg,.jpeg,.webp,.bmp,.avif,.heic,.heif',
  multiple: false,

  async renderInteractivePanel(files, _options): Promise<HTMLElement> {
    const file = files[0];
    const wrap = document.createElement('div');
    wrap.className = 'metadata-panel';

    // Loading state
    const loading = document.createElement('div');
    loading.className = 'reorder-loading';
    loading.innerHTML = `<span class="process-btn__spinner" aria-hidden="true"></span><span>Reading file info…</span>`;
    wrap.appendChild(loading);

    const info = await readImageInfo(file);
    loading.remove();

    const ext    = file.name.split('.').pop()?.toUpperCase() || '?';
    const mime   = file.type || `image/${ext.toLowerCase()}`;
    const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg';
    const modDate = new Date(file.lastModified).toLocaleString();

    // Metadata fields table
    const rows: [string, string, boolean][] = [
      ['File Name',      escapeHtml(file.name),                             false],
      ['File Size',      formatBytes(file.size),                            false],
      ['Dimensions',     info.width > 0 ? `${info.width} × ${info.height} px` : 'Unknown', false],
      ['Format',         mime,                                              false],
      ['Last Modified',  modDate,                                           false],
      ['EXIF / APP1',    isJpeg ? (info.hasExifMarker ? 'Detected ✓' : 'Not found') : 'N/A (non-JPEG)', isJpeg && info.hasExifMarker],
      ['GPS Location',   isJpeg && info.hasExifMarker ? 'May be embedded — will be removed' : 'N/A', isJpeg && info.hasExifMarker],
      ['Camera / Device','May be embedded — will be removed',               isJpeg && info.hasExifMarker],
      ['Color Profile',  'Re-encoded on canvas (ICC stripped)',             true],
      ['Timestamps',     'EXIF timestamps stripped',                        isJpeg && info.hasExifMarker],
    ];

    wrap.innerHTML = `
      <div class="metadata-panel__header">
        <span class="metadata-panel__title">File Metadata Preview</span>
        <span class="metadata-panel__subtitle">Fields marked <span class="metadata-tag">will be removed</span> after processing.</span>
      </div>
      <table class="metadata-panel__table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Current Value</th>
            <th>After Strip</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(([label, value, willChange]) => `
            <tr class="${willChange ? 'metadata-panel__row--changed' : ''}">
              <td>${escapeHtml(label)}</td>
              <td>${escapeHtml(value)}</td>
              <td>${willChange ? '<span class="metadata-tag">Removed</span>' : '<span class="metadata-ok">Kept</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p class="metadata-panel__note">
        ℹ️ The image is redrawn to a clean canvas, which strips all embedded metadata.
        ${!isJpeg ? 'PNG/WebP files may also contain metadata chunks that will be removed.' : ''}
      </p>
    `;

    return wrap;
  },
};

export default stripMetadata;
