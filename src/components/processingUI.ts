import { formatFileSize } from './dropZone';
import { escapeHtml } from '../utils/escapeHtml';
import JSZip from 'jszip';

interface DownloadEntry {
  filename: string;
  blob: Blob;
}

interface DownloadOptions {
  onRestart: () => void;
  onProcessAgain?: () => void;
  comparison?: {
    direction: 'smaller' | 'larger';
    percent: number;
  };
  canCopyText?: boolean;
  additionalDownloads?: DownloadEntry[];
  enableShare?: boolean;
}

export function showProcessing(
  container: HTMLElement,
  onCancel?: () => void
): {
  updateProgress: (percent: number) => void;
} {
  container.innerHTML = `
    <div class="processing" id="processing-state">
      <div class="processing__spinner">
        <div class="processing__block"></div>
        <div class="processing__block"></div>
        <div class="processing__block"></div>
        <div class="processing__block"></div>
        <div class="processing__block"></div>
      </div>
      <p class="processing__text">Processing...</p>
      <p class="processing__status" id="processing-status">Starting...</p>
      <div class="processing__progress">
        <div class="processing__progress-bar" id="progress-bar"></div>
      </div>
      <p class="processing__percent" id="progress-percent">0%</p>
      ${onCancel ? `<button class="processing__cancel" id="cancel-btn" type="button">Cancel</button>` : ''}
    </div>
  `;

  if (onCancel) {
    container.querySelector('#cancel-btn')?.addEventListener('click', onCancel);
  }

  const progressBar = container.querySelector('#progress-bar') as HTMLElement;
  const progressStatus = container.querySelector('#processing-status') as HTMLElement;
  const progressPercent = container.querySelector('#progress-percent') as HTMLElement;

  return {
    updateProgress: (percent: number) => {
      const clamped = Math.min(100, Math.max(0, percent));
      progressBar.style.width = `${clamped}%`;
      progressPercent.textContent = `${Math.round(clamped)}%`;

      if (clamped < 20) {
        progressStatus.textContent = 'Starting...';
      } else if (clamped < 45) {
        progressStatus.textContent = 'Reading files...';
      } else if (clamped < 75) {
        progressStatus.textContent = 'Processing...';
      } else if (clamped < 100) {
        progressStatus.textContent = 'Almost done...';
      } else {
        progressStatus.textContent = 'Done';
      }
    },
  };
}

export function showDownload(
  container: HTMLElement,
  blob: Blob,
  filename: string,
  options: DownloadOptions
): { cleanup: () => void } {
  const {
    onRestart,
    onProcessAgain,
    comparison,
    canCopyText = false,
    additionalDownloads = [],
    enableShare = true,
  } = options;

  const url = URL.createObjectURL(blob);
  const extraUrls = additionalDownloads.map((item) => ({
    ...item,
    url: URL.createObjectURL(item.blob),
  }));

  // previewUrl is set asynchronously by renderDownloadPreview; keep it in closure
  // so cleanup() always revokes it regardless of when it was assigned.
  let previewUrl: string | null = null;
  const setPreviewUrl = (u: string) => { previewUrl = u; };

  const cleanup = () => {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    URL.revokeObjectURL(url);
    extraUrls.forEach((item) => URL.revokeObjectURL(item.url));
  };

  const sizeStr = formatFileSize(blob.size);
  const isShareSupported = enableShare && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const lastDot = filename.lastIndexOf('.');
  const baseName = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : '';
  const safeFilename = escapeHtml(filename);
  const safeExt = escapeHtml(ext);
  const isPrimaryZip = blob.type === 'application/zip' || filename.toLowerCase().endsWith('.zip');

  container.innerHTML = `
    <div class="download-area" id="download-state">
      <div class="download-area__icon">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <h2 class="download-area__title">Done!</h2>
      <p class="download-area__size">${sizeStr}</p>
      <div class="download-area__filename">
        <label class="download-area__filename-label" for="filename-input">File Name</label>
        <div class="download-area__filename-row">
          <input
            type="text"
            class="download-area__filename-input"
            id="filename-input"
            value="${escapeHtml(baseName)}"
            spellcheck="false"
          />
          <span class="download-area__filename-ext">${safeExt}</span>
        </div>
      </div>
      ${comparison ? `<p class="download-area__compare">Output ${comparison.percent.toFixed(1)}% ${comparison.direction === 'smaller' ? 'smaller' : 'larger'}.</p>` : ''}
      <div class="download-area__actions">
        <a class="download-btn" id="download-btn" href="${url}" download="${safeFilename}">
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </a>
        ${isShareSupported ? `<button class="download-alt-btn" id="share-btn" type="button">Share</button>` : ''}
        ${canCopyText ? `<button class="download-alt-btn" id="copy-btn" type="button">Copy to Clipboard</button>` : ''}
        ${extraUrls.length > 0 && !isPrimaryZip ? `<button class="download-alt-btn" id="download-all-btn" type="button">Download All as ZIP</button>` : ''}
      </div>
      ${isPreviewSupported(blob, filename) ? `<div class="download-area__preview" id="download-preview"><h3 class="download-area__preview-title">Preview</h3><div class="download-area__preview-body" id="download-preview-body"></div></div>` : ''}
      ${extraUrls.length > 0 ? `<div class="download-area__list" id="download-list"><h3 class="download-area__list-title">Download Individually</h3><ul class="download-area__list-items"></ul></div>` : ''}
      <div class="download-area__restart-row">
        ${onProcessAgain ? `<button class="download-area__restart download-area__restart--again" id="process-again-btn" type="button">Process Again (Same File)</button>` : ''}
        <button class="download-area__restart" id="restart-btn" type="button">Start Over</button>
      </div>
    </div>
  `;

  const filenameInput = container.querySelector('#filename-input') as HTMLInputElement;
  const downloadBtn = container.querySelector('#download-btn') as HTMLAnchorElement;

  setupFilenameInput(filenameInput, downloadBtn, baseName, ext);
  if (extraUrls.length > 0) setupExtraList(container, extraUrls);

  const previewBody = container.querySelector('#download-preview-body') as HTMLElement | null;
  if (previewBody) void renderDownloadPreview(previewBody, blob, filename, setPreviewUrl);

  setupShareButton(container, blob, filenameInput, baseName, ext);
  setupCopyButton(container, blob);
  setupDownloadAllButton(container, blob, filenameInput, baseName, ext, extraUrls);

  const restartBtn = container.querySelector('#restart-btn') as HTMLButtonElement;
  restartBtn.addEventListener('click', () => {
    cleanup();
    onRestart();
  });

  const processAgainBtn = container.querySelector('#process-again-btn') as HTMLButtonElement | null;
  processAgainBtn?.addEventListener('click', () => {
    cleanup();
    onProcessAgain?.();
  });

  return { cleanup };
}

function setupFilenameInput(
  input: HTMLInputElement,
  downloadBtn: HTMLAnchorElement,
  baseName: string,
  ext: string
): void {
  input.addEventListener('input', () => {
    const newName = input.value.trim() || baseName;
    downloadBtn.setAttribute('download', newName + ext);
  });
}

function setupExtraList(
  container: HTMLElement,
  extraUrls: { filename: string; url: string }[]
): void {
  const list = container.querySelector('#download-list .download-area__list-items') as HTMLUListElement;
  extraUrls.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'download-area__list-item';
    li.innerHTML = `
      <a class="download-area__list-link" href="${item.url}" download="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</a>
    `;
    list.appendChild(li);
  });
}

function setupShareButton(
  container: HTMLElement,
  blob: Blob,
  filenameInput: HTMLInputElement,
  baseName: string,
  ext: string
): void {
  const shareBtn = container.querySelector('#share-btn') as HTMLButtonElement | null;
  shareBtn?.addEventListener('click', async () => {
    const newName = (filenameInput.value.trim() || baseName) + ext;
    try {
      const fileToShare = new File([blob], newName, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare?.({ files: [fileToShare] })) {
        await navigator.share({ files: [fileToShare], title: newName });
      } else {
        await navigator.share({ title: newName, text: 'Generated with OffFile' });
      }
    } catch {
      // Share cancelled or not available on this platform.
    }
  });
}

function setupCopyButton(container: HTMLElement, blob: Blob): void {
  const copyBtn = container.querySelector('#copy-btn') as HTMLButtonElement | null;
  if (!copyBtn) return;

  copyBtn.addEventListener('click', async () => {
    if (!navigator.clipboard) {
      flashButton(copyBtn, 'Copy failed', 'Copy to Clipboard');
      return;
    }
    try {
      const text = await blob.text();
      await navigator.clipboard.writeText(text);
      flashButton(copyBtn, 'Copied', 'Copy to Clipboard');
    } catch {
      flashButton(copyBtn, 'Copy failed', 'Copy to Clipboard');
    }
  });
}

function setupDownloadAllButton(
  container: HTMLElement,
  blob: Blob,
  filenameInput: HTMLInputElement,
  baseName: string,
  ext: string,
  extraUrls: { filename: string; blob: Blob }[]
): void {
  const btn = container.querySelector('#download-all-btn') as HTMLButtonElement | null;
  if (!btn || !extraUrls.length) return;

  btn.addEventListener('click', async () => {
    const defaultName = (filenameInput.value.trim() || baseName) + ext;
    btn.disabled = true;
    const previousLabel = btn.textContent;
    btn.textContent = 'Preparing ZIP...';

    try {
      const zip = new JSZip();
      zip.file(defaultName, blob);
      extraUrls.forEach((entry) => { zip.file(entry.filename, entry.blob); });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const zipLink = document.createElement('a');
      zipLink.href = zipUrl;
      zipLink.download = `${defaultName.replace(/\.[^.]+$/, '')}_all.zip`;
      zipLink.click();
      URL.revokeObjectURL(zipUrl);
    } catch {
      btn.textContent = 'ZIP failed';
      window.setTimeout(() => {
        btn.textContent = previousLabel || 'Download All as ZIP';
      }, 1200);
    } finally {
      btn.disabled = false;
      if (btn.textContent !== 'ZIP failed') {
        btn.textContent = previousLabel || 'Download All as ZIP';
      }
    }
  });
}

function flashButton(btn: HTMLButtonElement, tempLabel: string, resetLabel: string): void {
  btn.textContent = tempLabel;
  window.setTimeout(() => { btn.textContent = resetLabel; }, 1200);
}

export function showError(
  container: HTMLElement,
  message: string,
  opts: { onRetry: () => void; onRestart?: () => void }
): void {
  const { onRetry, onRestart } = opts;
  const friendlyMessage = getFriendlyErrorMessage(message);

  container.innerHTML = `
    <div class="error-area" id="error-state">
      <div class="error-area__icon">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <h2 class="error-area__title">Something went wrong</h2>
      <p class="error-area__text">${escapeHtml(friendlyMessage)}</p>
      <details class="error-area__details">
        <summary>Technical details</summary>
        <pre>${escapeHtml(message)}</pre>
      </details>
      <div class="error-area__actions">
        <button class="process-btn process-btn--ready error-area__retry" id="error-retry-btn" type="button">
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
          Try Again
        </button>
        ${onRestart ? `<button class="download-alt-btn" id="error-restart-btn" type="button">Start Over</button>` : ''}
      </div>
    </div>
  `;

  const retryBtn = container.querySelector('#error-retry-btn') as HTMLButtonElement;
  retryBtn.addEventListener('click', onRetry);

  const restartBtn = container.querySelector('#error-restart-btn') as HTMLButtonElement | null;
  restartBtn?.addEventListener('click', () => onRestart!());
}

function isPreviewSupported(blob: Blob, filename: string): boolean {
  return blob.type.startsWith('image/') || isTextPreview(blob, filename);
}

function isTextPreview(blob: Blob, filename: string): boolean {
  if (blob.type.startsWith('text/')) return true;
  return /\.(txt|md|csv|json|xml|html|css|js|ts)$/i.test(filename);
}

async function renderDownloadPreview(
  previewBody: HTMLElement,
  blob: Blob,
  filename: string,
  onPreviewUrl: (url: string) => void
): Promise<void> {
  if (blob.type.startsWith('image/')) {
    const imageUrl = URL.createObjectURL(blob);
    onPreviewUrl(imageUrl);
    previewBody.innerHTML = `<img class="download-area__preview-image" src="${imageUrl}" alt="Output preview" />`;
    return;
  }

  if (!isTextPreview(blob, filename)) {
    previewBody.innerHTML = '<p class="download-area__preview-note">Preview is not available for this file type.</p>';
    return;
  }

  try {
    const text = await blob.text();
    const trimmed = text.trim();
    const clipped = trimmed.length > 1800 ? `${trimmed.slice(0, 1800)}\n\n...` : trimmed;
    previewBody.innerHTML = '<pre class="download-area__preview-text"></pre>';
    const pre = previewBody.querySelector('.download-area__preview-text') as HTMLPreElement;
    pre.textContent = clipped || '(empty output)';
  } catch {
    previewBody.innerHTML = '<p class="download-area__preview-note">Preview could not be generated for this output.</p>';
  }
}

function getFriendlyErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('unsupported') || normalized.includes('not supported')) {
    return 'This input or option is not supported for the selected tool.';
  }

  if (normalized.includes('password') || normalized.includes('encrypt')) {
    return 'This file is protected or needs an option that is unavailable in this tool.';
  }

  if (normalized.includes('memory') || normalized.includes('out of')) {
    return 'The file may be too large for this browser session. Try smaller files or batch mode.';
  }

  return 'The operation could not be completed. You can retry or check technical details below.';
}
