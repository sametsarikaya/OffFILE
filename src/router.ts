import { createNavbar } from './components/navbar';
import { createToolGrid } from './components/toolGrid';
import { createDropZone, createFileList } from './components/dropZone';
import { showProcessing, showDownload, showError } from './components/processingUI';
import { createOptionsPanel } from './components/optionsPanel';
import { showShortcutsModal, hideShortcutsModal, isShortcutsModalOpen } from './components/shortcutsModal';
import { getAllTools, getToolById, getToolsByCategory, categories } from './tools/registry';
import { runTool, runToolBatch, cancelCurrentTool } from './worker/workerClient';
import { escapeHtml } from './utils/escapeHtml';
import { getFavoriteIds, isFavorite, toggleFavorite } from './utils/favorites';
import type { Tool } from './types';
import JSZip from 'jszip';

const app = document.getElementById('app')!;
let hasRenderedRoute = false;
let routeTransitionTimer: number | undefined;

const comparisonToolIds = new Set([
  'compress-pdf',
  'image-compress',
  'strip-metadata',
]);

export function initRouter(): void {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute(): void {
  const hash = window.location.hash || '#/';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Revoke any blob URLs from a previous download state before rendering new route
  callDownloadCleanup();

  const render = () => {
    if (hash.startsWith('#/tool/')) {
      const toolId = hash.replace('#/tool/', '');
      renderToolPage(toolId);
    } else {
      renderHome();
    }
  };

  if (!hasRenderedRoute || reducedMotion) {
    app.classList.remove('route-exit');
    app.classList.add('route-enter');
    render();
    hasRenderedRoute = true;
    return;
  }

  if (routeTransitionTimer) {
    window.clearTimeout(routeTransitionTimer);
  }

  app.classList.remove('route-enter');
  app.classList.add('route-exit');

  routeTransitionTimer = window.setTimeout(() => {
    render();
    app.classList.remove('route-exit');
    app.classList.add('route-enter');
  }, 110);
}

function renderHome(): void {
  const initialSearchQuery = getHomeSearchQuery(window.location.hash || '#/');

  app.innerHTML = '';
  let applyHomeSearch = (_query: string): void => {};
  app.appendChild(
    createNavbar({
      searchValue: initialSearchQuery,
      searchPlaceholder: `Search in ${getAllTools().length} tools...`,
      onSearchInput: (query) => applyHomeSearch(query),
    })
  );

  const main = document.createElement('main');
  main.className = 'main-content';

  const container = document.createElement('div');
  container.className = 'container';

  // Hero
  const hero = document.createElement('section');
  hero.className = 'hero';
  hero.id = 'hero-section';
  hero.innerHTML = `
    <h1 class="hero__title">
      Fast File Tools,
      <span class="hero__title-highlight">Zero Upload.</span>
    </h1>
    <p class="hero__subtitle">
      All tools run in your browser. No uploads, no accounts.
    </p>
  `;
  container.appendChild(hero);

  // Favorites section - rendered and re-renderable on star toggle
  const favoritesSlot = document.createElement('div');
  favoritesSlot.id = 'favorites-slot';
  container.appendChild(favoritesSlot);

  const renderFavoritesSection = () => {
    favoritesSlot.innerHTML = '';
    const favIds = getFavoriteIds();
    if (favIds.length === 0) return;

    const favTools = favIds
      .map((id) => getToolById(id))
      .filter((t): t is Tool => t !== undefined);
    if (favTools.length === 0) return;

    const section = document.createElement('section');
    section.className = 'category-section favorites-section';
    section.id = 'category-favorites';

    const heading = document.createElement('h2');
    heading.className = 'category-section__title favorites-section__title';
    heading.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      Favorite Tools
    `;
    section.appendChild(heading);
    section.appendChild(createToolGrid(favTools));
    favoritesSlot.appendChild(section);
  };

  // Sync star button visual state across all cards on the page for a given tool id.
  const syncStarButtons = (toolId: string) => {
    const starred = isFavorite(toolId);
    container.querySelectorAll<HTMLButtonElement>(`.tool-card__star[data-tool-id="${toolId}"]`).forEach((btn) => {
      btn.classList.toggle('is-starred', starred);
      btn.setAttribute('aria-pressed', String(starred));
      btn.setAttribute('aria-label', starred ? 'Remove from favorites' : 'Add to favorites');
    });
  };

  renderFavoritesSection();

  // Re-render favorites section and sync all star buttons when any star is toggled.
  container.addEventListener('favorite-changed', (e) => {
    const toolId = (e as CustomEvent<string>).detail;
    renderFavoritesSection();
    if (toolId) syncStarButtons(toolId);
  });

  // Categorized Tool Grids
  const allCatSections: HTMLElement[] = [];
  categories.forEach((cat) => {
    const catTools = getToolsByCategory(cat.id);
    if (catTools.length === 0) return;

    const section = document.createElement('section');
    section.className = 'category-section';
    section.id = `category-${cat.id}`;

    const heading = document.createElement('h2');
    heading.className = 'category-section__title';
    heading.textContent = cat.label;

    section.appendChild(heading);
    section.appendChild(createToolGrid(catTools));
    container.appendChild(section);
    allCatSections.push(section);
  });

  // Footer
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <section class="privacy-bar" aria-label="Privacy guarantee">
      <div class="privacy-bar__inner">
        <div class="privacy-bar__lead">
          <div class="privacy-bar__shield">
            <svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div class="privacy-bar__lead-copy">
            <div class="privacy-bar__eyebrow">100% Client-Side</div>
            <h2 class="privacy-bar__heading">Privacy<br>First.</h2>
            <p class="privacy-bar__tagline">Your files never leave this browser — no servers, no uploads, no tracking.</p>
          </div>
        </div>
        <div class="privacy-bar__pillars">
          <div class="privacy-bar__pillar">
            <div class="privacy-bar__pillar-icon">
              <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </div>
            <strong class="privacy-bar__pillar-label">No Upload</strong>
            <span class="privacy-bar__pillar-desc">All processing happens locally — files never leave your device</span>
          </div>
          <div class="privacy-bar__pillar">
            <div class="privacy-bar__pillar-icon">
              <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </div>
            <strong class="privacy-bar__pillar-label">No Tracking</strong>
            <span class="privacy-bar__pillar-desc">Zero analytics, no cookies, no data collection of any kind</span>
          </div>
          <div class="privacy-bar__pillar">
            <div class="privacy-bar__pillar-icon">
              <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <strong class="privacy-bar__pillar-label">Works Offline</strong>
            <span class="privacy-bar__pillar-desc">No internet required after first load — fully self-contained</span>
          </div>
          <div class="privacy-bar__pillar">
            <div class="privacy-bar__pillar-icon">
              <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <strong class="privacy-bar__pillar-label">Open Source</strong>
            <span class="privacy-bar__pillar-desc">AGPL-3.0 licensed — fully auditable code, no hidden behavior</span>
          </div>
        </div>
      </div>
      <div class="privacy-bar__bottom">
        <span class="privacy-bar__bottom-brand">OffFILE</span>
        <span class="privacy-bar__bottom-sep">|</span>
        <a class="privacy-bar__bottom-link" href="https://github.com/sametsarikaya/OffFILE" target="_blank" rel="noopener noreferrer">github.com/sametsarikaya/OffFILE</a>
        <span class="privacy-bar__bottom-sep">|</span>
        <span class="privacy-bar__bottom-tag">Open Source File Tools</span>
        <span class="privacy-bar__bottom-sep">|</span>
        <span class="privacy-bar__bottom-count">${getAllTools().length} Tools</span>
      </div>
    </section>
  `;
  container.appendChild(footer);

  // Search logic (navbar-integrated)
  let searchResultSection: HTMLElement | null = null;
  applyHomeSearch = (rawQuery: string) => {
    const trimmedQuery = rawQuery.trim();
    const q = trimmedQuery.toLowerCase();

    searchResultSection?.remove();
    searchResultSection = null;

    if (!q) {
      favoritesSlot.style.display = '';
      allCatSections.forEach((s) => { s.style.display = ''; });
      if ((window.location.hash || '#/') !== '#/') {
        window.history.replaceState(null, '', '#/');
      }
      return;
    }

    if ((window.location.hash || '#/') !== buildHomeHash(trimmedQuery)) {
      window.history.replaceState(null, '', buildHomeHash(trimmedQuery));
    }

    favoritesSlot.style.display = 'none';
    allCatSections.forEach((s) => { s.style.display = 'none'; });

    const matched = getAllTools().filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );

    searchResultSection = document.createElement('section');
    searchResultSection.className = 'category-section';

    const heading = document.createElement('h2');
    heading.className = 'category-section__title';
    heading.textContent = matched.length > 0
      ? `${matched.length} result(s) for "${trimmedQuery}"`
      : `No results found for "${trimmedQuery}"`;
    searchResultSection.appendChild(heading);

    if (matched.length > 0) {
      searchResultSection.appendChild(createToolGrid(matched));
    }

    container.insertBefore(searchResultSection, footer);
  };

  if (initialSearchQuery) {
    applyHomeSearch(initialSearchQuery);
  }

  main.appendChild(container);
  app.appendChild(main);

  // Global ? shortcut on home page
  const onHomeKey = (e: KeyboardEvent) => {
    if (e.key === '?' && !isInputFocused()) {
      e.preventDefault();
      if (isShortcutsModalOpen()) {
        hideShortcutsModal();
      } else {
        showShortcutsModal();
      }
    }
    if (e.key === 'Escape' && isShortcutsModalOpen()) {
      hideShortcutsModal();
    }
  };
  document.addEventListener('keydown', onHomeKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onHomeKey), { once: true });
}

function renderToolPage(toolId: string): void {
  const tool = getToolById(toolId);
  if (!tool) {
    window.location.hash = '#/';
    return;
  }

  app.innerHTML = '';
  app.appendChild(
    createNavbar({
      searchPlaceholder: `Search in ${getAllTools().length} tools...`,
      onSearchInput: (query) => {
        window.location.hash = buildHomeHash(query);
      },
    })
  );

  const main = document.createElement('main');
  main.className = 'main-content';

  const container = document.createElement('div');
  container.className = 'container';

  const page = document.createElement('div');
  page.className = 'tool-page';
  page.id = `tool-page-${tool.id}`;

  // Header
  const header = document.createElement('div');
  header.className = 'tool-header';

  const isStarred = isFavorite(tool.id);
  header.innerHTML = `
    <button class="tool-header__back" id="back-btn" aria-label="Back to home" type="button">
      <svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
    </button>
    <div class="tool-header__info">
      <h1 class="tool-header__title">${escapeHtml(tool.title)}</h1>
      <p class="tool-header__desc">${escapeHtml(tool.description)}</p>
    </div>
    <button
      class="tool-header__star${isStarred ? ' is-starred' : ''}"
      id="header-star-btn"
      aria-label="${isStarred ? 'Remove from favorites' : 'Add to favorites'}"
      aria-pressed="${isStarred}"
      type="button"
    >
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
  `;

  header.querySelector('#back-btn')!.addEventListener('click', () => {
    callDownloadCleanup();
    window.location.hash = '#/';
  });

  const headerStarBtn = header.querySelector<HTMLButtonElement>('#header-star-btn')!;
  headerStarBtn.addEventListener('click', () => {
    const nowFav = toggleFavorite(tool.id);
    headerStarBtn.classList.toggle('is-starred', nowFav);
    headerStarBtn.setAttribute('aria-pressed', String(nowFav));
    headerStarBtn.setAttribute('aria-label', nowFav ? 'Remove from favorites' : 'Add to favorites');
  });

  const workArea = document.createElement('div');
  workArea.id = 'work-area';

  page.appendChild(header);
  page.appendChild(workArea);
  container.appendChild(page);
  main.appendChild(container);
  app.appendChild(main);

  // Keyboard shortcuts
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isShortcutsModalOpen()) {
        hideShortcutsModal();
      } else {
        callDownloadCleanup();
        window.location.hash = '#/';
      }
    } else if (e.key === '?' && !isInputFocused()) {
      e.preventDefault();
      isShortcutsModalOpen() ? hideShortcutsModal() : showShortcutsModal();
    } else if (e.key === 'Enter' && !isInputFocused()) {
      const processBtn = document.getElementById('process-btn') as HTMLButtonElement | null;
      processBtn?.click();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isInputFocused()) {
      // Ctrl/Cmd+Z → Start Over (return to drop zone)
      e.preventDefault();
      renderDropState(tool, workArea);
    }
  };
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKeyDown), { once: true });

  renderDropState(tool, workArea);
}

/* ---- Per-page state ---- */
/* Scoped to renderToolPage via closure; reset on each new drop state */
let selectedFiles: File[] = [];
let currentOptions: Record<string, unknown> = {};
let downloadCleanup: (() => void) | null = null;

function callDownloadCleanup(): void {
  if (downloadCleanup) {
    downloadCleanup();
    downloadCleanup = null;
  }
}

function renderDropState(tool: Tool, workArea: HTMLElement): void {
  callDownloadCleanup();
  while (workArea.firstChild) workArea.removeChild(workArea.firstChild);
  // Reset state
  selectedFiles = [];
  currentOptions = {};

  if (tool.options) {
    tool.options.forEach((opt) => {
      currentOptions[opt.id] = opt.defaultValue;
    });
  }

  if (tool.skipDropZone) {
    workArea.appendChild(buildProcessBtnRow(tool, workArea));
    return;
  }

  const dropZone = createDropZone({
    acceptedTypes: tool.acceptedTypes,
    multiple: tool.multiple,
    color: tool.color,
    maxWarnBytes: tool.maxWarnBytes,
    onFiles: (files) => {
      selectedFiles = tool.multiple
        ? [...selectedFiles, ...files]
        : [files[0]];
      renderFilesSelected(tool, workArea);
    },
  });

  workArea.appendChild(dropZone);
}

function renderFilesSelected(tool: Tool, workArea: HTMLElement): void {
  workArea.innerHTML = '';
  appendAddMoreZone(tool, workArea);
  workArea.appendChild(buildFileList(tool, workArea));
  workArea.appendChild(buildProcessBtnRow(tool, workArea));
}

function appendAddMoreZone(tool: Tool, workArea: HTMLElement): void {
  const isBatchMode = !tool.multiple && selectedFiles.length > 1;
  if (!tool.multiple && !isBatchMode) return;

  const zone = createDropZone({
    acceptedTypes: tool.acceptedTypes,
    multiple: true,
    color: tool.color,
    maxWarnBytes: tool.maxWarnBytes,
    onFiles: (files) => {
      selectedFiles = [...selectedFiles, ...files];
      renderFilesSelected(tool, workArea);
    },
  });

  if (isBatchMode) {
    zone.style.minHeight = '80px';
    zone.style.padding = '16px';
    const title = zone.querySelector('.dropzone__title');
    if (title) title.textContent = 'Add Files for Batch';
  } else {
    zone.style.minHeight = '120px';
    zone.style.padding = '24px';
    const title = zone.querySelector('.dropzone__title');
    if (title) title.textContent = 'Add More Files';
  }
  const subtitle = zone.querySelector('.dropzone__subtitle');
  if (subtitle) subtitle.textContent = '';
  workArea.appendChild(zone);
}

function buildFileList(tool: Tool, workArea: HTMLElement): HTMLElement {
  return createFileList(
    selectedFiles,
    (index) => {
      selectedFiles = selectedFiles.filter((_, i) => i !== index);
      if (selectedFiles.length === 0) {
        renderDropState(tool, workArea);
      } else {
        renderFilesSelected(tool, workArea);
      }
    },
    tool.multiple ? (reordered) => { selectedFiles = reordered; } : undefined
  );
}

function buildProcessBtnRow(tool: Tool, workArea: HTMLElement): HTMLElement {
  const btnRow = document.createElement('div');
  btnRow.className = 'process-btn-row';

  const processBtn = document.createElement('button');
  processBtn.id = 'process-btn';
  processBtn.type = 'button';

  const readyBtnHTML = `
    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
    ${getProcessButtonLabel(tool, selectedFiles.length)}
  `;

  const enableProcessBtn = () => {
    processBtn.disabled = false;
    processBtn.className = 'process-btn process-btn--ready';
    processBtn.innerHTML = readyBtnHTML;
  };

  mountOptionsPanel(tool, workArea, processBtn, enableProcessBtn);
  wireProcessBtn(processBtn, tool, workArea);
  btnRow.appendChild(processBtn);
  return btnRow;
}

function mountOptionsPanel(
  tool: Tool,
  workArea: HTMLElement,
  processBtn: HTMLButtonElement,
  enableProcessBtn: () => void
): void {
  if (tool.renderInteractivePanel) {
    processBtn.className = 'process-btn process-btn--loading';
    processBtn.disabled = true;
    processBtn.innerHTML = `<span class="process-btn__spinner" aria-hidden="true"></span> Loading...`;

    tool.renderInteractivePanel(selectedFiles, currentOptions)
      .then((el) => {
        const btnRowEl = workArea.querySelector('.process-btn-row');
        if (btnRowEl) workArea.insertBefore(el, btnRowEl);
        else workArea.appendChild(el);
        enableProcessBtn();
      })
      .catch(() => {
        if (tool.options && tool.options.length > 0) {
          const btnRowEl = workArea.querySelector('.process-btn-row');
          const panel = createOptionsPanel(tool.options, currentOptions);
          if (btnRowEl) workArea.insertBefore(panel, btnRowEl);
          else workArea.appendChild(panel);
        }
        enableProcessBtn();
      });
  } else {
    if (tool.options && tool.options.length > 0) {
      workArea.appendChild(createOptionsPanel(tool.options, currentOptions));
    }
    enableProcessBtn();
  }
}

function wireProcessBtn(processBtn: HTMLButtonElement, tool: Tool, workArea: HTMLElement): void {
  processBtn.addEventListener('click', () => {
    processBtn.disabled = true;
    processBtn.classList.remove('process-btn--ready');
    processBtn.classList.add('process-btn--loading');
    processBtn.innerHTML = `<span class="process-btn__spinner" aria-hidden="true"></span> Processing...`;

    if (!tool.multiple && selectedFiles.length > 1) {
      void runBatchProcess(tool, workArea);
      return;
    }
    void runProcess(tool, workArea);
  });
}

async function runProcess(tool: Tool, workArea: HTMLElement): Promise<void> {
  const files = [...selectedFiles];
  const options = { ...currentOptions };
  const inputTotalBytes = files.reduce((acc, file) => acc + file.size, 0);

  const { updateProgress } = showProcessing(workArea, () => {
    cancelCurrentTool();
    renderDropState(tool, workArea);
  });

  try {
    await delay(300);
    const result = await runTool(tool.id, files, options, (percent) => {
      updateProgress(percent);
    });

    // Color palette - render inline swatches instead of a download
    if (tool.resultType === 'color-palette-json') {
      void showColorPaletteResult(workArea, result.blob, result.filename, () => {
        renderDropState(tool, workArea);
      }).catch((err) => {
        const message = err instanceof Error ? err.message : 'Could not render palette.';
        showError(workArea, message, { onRetry: () => renderFilesSelected(tool, workArea), onRestart: () => renderDropState(tool, workArea) });
      });
      return;
    }

    const comparison = getComparisonData(tool.id, inputTotalBytes, result.blob.size);
    const additionalDownloads = await extractZipEntries(result.blob, result.filename);
    const renderAgain = tool.skipDropZone
      ? () => renderDropState(tool, workArea)
      : () => renderFilesSelected(tool, workArea);
    const { cleanup } = showDownload(workArea, result.blob, result.filename, {
      onRestart: () => renderDropState(tool, workArea),
      onProcessAgain: renderAgain,
      comparison,
      canCopyText: isTextOutput(result.blob, result.filename),
      additionalDownloads,
      enableShare: true,
    });
    downloadCleanup = cleanup;
  } catch (err) {
    if (err instanceof Error && err.message === 'Cancelled') return;
    const message = err instanceof Error ? err.message : 'An unknown error occurred.';
    const renderAgain = tool.skipDropZone
      ? () => renderDropState(tool, workArea)
      : () => renderFilesSelected(tool, workArea);
    showError(workArea, message, {
      onRetry: renderAgain,
      onRestart: () => renderDropState(tool, workArea),
    });
  }
}

async function runBatchProcess(tool: Tool, workArea: HTMLElement): Promise<void> {
  const files = [...selectedFiles];
  const options = { ...currentOptions };
  const inputTotalBytes = files.reduce((acc, file) => acc + file.size, 0);
  let cancelled = false;

  const { updateProgress } = showProcessing(workArea, () => {
    cancelled = true;
    cancelCurrentTool();
    renderDropState(tool, workArea);
  });

  try {
    await delay(300);
    const results = await runToolBatch(tool.id, files, options, (percent) => {
      updateProgress(percent);
    });

    if (cancelled) return;

    // Bundle results as ZIP
    const zip = new JSZip();
    results.forEach(({ blob, filename }) => {
      zip.file(filename, blob);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const rawOutputBytes = results.reduce((acc, item) => acc + item.blob.size, 0);
    const comparison = getComparisonData(tool.id, inputTotalBytes, rawOutputBytes);

    const { cleanup: batchCleanup } = showDownload(workArea, zipBlob, `${tool.id}_batch.zip`, {
      onRestart: () => {
        renderDropState(tool, workArea);
      },
      onProcessAgain: () => {
        renderFilesSelected(tool, workArea);
      },
      comparison,
      additionalDownloads: results,
      enableShare: true,
    });
    downloadCleanup = batchCleanup;
  } catch (err) {
    if (cancelled || (err instanceof Error && err.message === 'Cancelled')) return;
    const message = err instanceof Error ? err.message : 'An unknown error occurred.';
    showError(workArea, message, {
      onRetry: () => renderFilesSelected(tool, workArea),
      onRestart: () => renderDropState(tool, workArea),
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHomeSearchQuery(hash: string): string {
  const queryMarkIndex = hash.indexOf('?');
  if (queryMarkIndex === -1) return '';
  const params = new URLSearchParams(hash.slice(queryMarkIndex + 1));
  return (params.get('q') ?? '').trim();
}

function buildHomeHash(query: string): string {
  const trimmed = query.trim();
  return trimmed ? `#/?q=${encodeURIComponent(trimmed)}` : '#/';
}

function isTextOutput(blob: Blob, filename: string): boolean {
  if (blob.type.startsWith('text/')) return true;
  return /\.(txt|md|csv|json|xml|html|css|js|ts)$/i.test(filename);
}

function getProcessButtonLabel(tool: Tool, fileCount: number): string {
  const action = getToolActionVerb(tool.id);
  if (fileCount > 1) return `${action} ${fileCount} Files`;
  return `${action} File`;
}

function getToolActionVerb(toolId: string): string {
  if (toolId.includes('merge')) return 'Merge';
  if (toolId.includes('split')) return 'Split';
  if (toolId.includes('compress')) return 'Compress';
  if (toolId.includes('extract')) return 'Extract';
  if (toolId.includes('rotate')) return 'Rotate';
  if (toolId.includes('resize')) return 'Resize';
  if (toolId.includes('crop')) return 'Crop';
  if (toolId.includes('watermark')) return 'Watermark';
  if (toolId.includes('metadata')) return 'Edit Metadata';
  if (toolId.includes('add') || toolId.includes('remove')) return 'Update';
  if (toolId.includes('to-') || toolId.includes('convert')) return 'Convert';
  return 'Process';
}

function getComparisonData(
  toolId: string,
  inputBytes: number,
  outputBytes: number
): { direction: 'smaller' | 'larger'; percent: number } | undefined {
  if (!comparisonToolIds.has(toolId) || inputBytes <= 0) return undefined;
  const ratio = ((outputBytes - inputBytes) / inputBytes) * 100;
  if (!Number.isFinite(ratio)) return undefined;
  return {
    direction: ratio <= 0 ? 'smaller' : 'larger',
    percent: Math.abs(ratio),
  };
}

async function extractZipEntries(
  blob: Blob,
  filename: string
): Promise<{ filename: string; blob: Blob }[]> {
  const isZip = blob.type === 'application/zip' || filename.toLowerCase().endsWith('.zip');
  if (!isZip) return [];

  try {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const files: { filename: string; blob: Blob }[] = [];

    for (const [entryName, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      files.push({
        filename: entryName,
        blob: await entry.async('blob'),
      });
    }

    return files;
  } catch {
    return [];
  }
}

async function showColorPaletteResult(
  workArea: HTMLElement,
  blob: Blob,
  _filename: string,
  onRestart: () => void
): Promise<void> {
  const text = await blob.text();
  let data: { source?: string; colors: { hex: string; r: number; g: number; b: number }[] };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    data = { colors: [] };
  }

  workArea.innerHTML = '';

  const area = document.createElement('div');
  area.className = 'palette-result';

  const header = document.createElement('div');
  header.className = 'palette-result__header';
  header.innerHTML = `
    <span class="palette-result__title">Color Palette</span>
    <span class="palette-result__source">${escapeHtml(data.source ?? '')}</span>
  `;
  area.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'palette-result__grid';

  data.colors.forEach(({ hex, r, g, b }) => {
    const luma  = 0.299 * r + 0.587 * g + 0.114 * b;
    const text  = luma > 140 ? '#111111' : '#FFFFFF';

    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'palette-swatch';
    swatch.style.setProperty('--swatch-color', hex);
    swatch.title = `Click to copy ${hex}`;
    swatch.innerHTML = `
      <div class="palette-swatch__color" style="background:${escapeHtml(hex)}"></div>
      <div class="palette-swatch__info" style="color:${escapeHtml(text)};background:${escapeHtml(hex)}">
        <span class="palette-swatch__hex">${escapeHtml(hex)}</span>
        <span class="palette-swatch__rgb">rgb(${r}, ${g}, ${b})</span>
      </div>
    `;

    // Copy hex on click
    swatch.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(hex);
        const info = swatch.querySelector('.palette-swatch__hex') as HTMLElement;
        const prev = info.textContent;
        info.textContent = 'Copied!';
        setTimeout(() => { info.textContent = prev; }, 1200);
      } catch { /* clipboard denied */ }
    });

    grid.appendChild(swatch);
  });

  area.appendChild(grid);

  // Action row
  const actions = document.createElement('div');
  actions.className = 'palette-result__actions';

  // Download as CSS variables
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'download-btn';
  downloadBtn.innerHTML = `
    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Download as CSS Variables
  `;
  downloadBtn.addEventListener('click', () => {
    const cssVars = data.colors
      .map((c, i) => `  --color-${i + 1}: ${c.hex};`)
      .join('\n');
    const css  = `:root {\n${cssVars}\n}\n`;
    const blob = new Blob([css], { type: 'text/css' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'palette.css';
    a.click();
    URL.revokeObjectURL(url);
  });
  actions.appendChild(downloadBtn);

  // Export palette as PNG image
  const pngBtn = document.createElement('button');
  pngBtn.type = 'button';
  pngBtn.className = 'download-btn';
  pngBtn.innerHTML = `
    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
    Export Palette PNG
  `;
  pngBtn.addEventListener('click', () => {
    const colors = data.colors;
    const cols   = Math.min(colors.length, 5);
    const rows   = Math.ceil(colors.length / cols);
    const swW = 160, swH = 128, pad = 12, titleH = 48;

    const canvas = document.createElement('canvas');
    canvas.width  = cols * swW + (cols + 1) * pad;
    canvas.height = rows * swH + (rows + 1) * pad + titleH;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#f5f0de';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#0a0a0a';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('COLOR PALETTE', canvas.width / 2, 32);

    colors.forEach(({ hex, r, g, b }, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = pad + col * (swW + pad);
      const y   = titleH + pad + row * (swH + pad);

      // Border
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(x - 2, y - 2, swW + 4, swH + 4);

      // Color block
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, swW, swH - 34);

      // Label strip
      ctx.fillStyle = hex;
      ctx.fillRect(x, y + swH - 34, swW, 34);

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      ctx.fillStyle = luma > 140 ? '#111111' : '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(hex.toUpperCase(), x + swW / 2, y + swH - 18);
      ctx.font = '11px monospace';
      ctx.fillText(`rgb(${r},${g},${b})`, x + swW / 2, y + swH - 4);
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'palette.png';
      a.click();
      URL.revokeObjectURL(url);
    });
  });
  actions.appendChild(pngBtn);

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'restart-btn';
  restartBtn.textContent = 'Start Over';
  restartBtn.addEventListener('click', onRestart);
  actions.appendChild(restartBtn);

  area.appendChild(actions);
  workArea.appendChild(area);
}

/** True when the user is typing in an input/textarea/select. */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}
