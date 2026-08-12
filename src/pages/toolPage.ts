import { createNavbar } from '../components/navbar';
import { createDropZone, createFileList } from '../components/dropZone';
import { createOptionsPanel } from '../components/optionsPanel';
import {
  showShortcutsModal,
  hideShortcutsModal,
  isShortcutsModalOpen,
} from '../components/shortcutsModal';
import { getAllTools, getToolById } from '../tools/registry';
import { escapeHtml } from '../utils/escapeHtml';
import { isFavorite, toggleFavorite } from '../utils/favorites';
import { buildHomeHash } from '../utils/hash';
import { isInputFocused, onRouteKeyDown, clearElement } from '../utils/dom';
import { announce } from '../utils/a11y';
import { createSession, defaultOptions, releaseDownload, setActiveSession } from './toolSession';
import type { ToolSession } from './toolSession';
import { runSingle, runBatch, processButtonLabel } from './toolRun';

const BACK_ICON = `<svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="19" y1="12" x2="5" y2="12"/>
  <polyline points="12 19 5 12 12 5"/>
</svg>`;

const STAR_ICON = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
</svg>`;

const PLAY_ICON = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="5 3 19 12 5 21 5 3"/>
</svg>`;

export function renderToolPage(app: HTMLElement, toolId: string): void {
  const tool = getToolById(toolId);
  if (!tool) {
    window.location.hash = '#/';
    return;
  }

  clearElement(app);
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
  main.id = 'main-content';
  main.tabIndex = -1;

  const container = document.createElement('div');
  container.className = 'container';

  const page = document.createElement('div');
  page.className = 'tool-page';
  page.id = `tool-page-${tool.id}`;

  const workArea = document.createElement('div');
  workArea.id = 'work-area';

  const session = createSession(tool, workArea);
  setActiveSession(session);

  page.appendChild(createHeader(session));
  page.appendChild(workArea);
  container.appendChild(page);
  main.appendChild(container);
  app.appendChild(main);
  onRouteKeyDown((e) => handleShortcut(e, session));
  renderDropState(session);
}

function createHeader(session: ToolSession): HTMLElement {
  const { tool } = session;
  const header = document.createElement('div');
  header.className = 'tool-header';

  const starred = isFavorite(tool.id);
  header.innerHTML = `
    <button class="tool-header__back" id="back-btn" aria-label="Back to home" type="button">${BACK_ICON}</button>
    <div class="tool-header__info">
      <h1 class="tool-header__title">${escapeHtml(tool.title)}</h1>
      <p class="tool-header__desc">${escapeHtml(tool.description)}</p>
    </div>
    <button
      class="tool-header__star${starred ? ' is-starred' : ''}"
      id="header-star-btn"
      aria-label="${starred ? 'Remove from favorites' : 'Add to favorites'}"
      aria-pressed="${starred}"
      type="button"
    >${STAR_ICON}</button>
  `;

  header.querySelector('#back-btn')!.addEventListener('click', () => {
    releaseDownload(session);
    window.location.hash = '#/';
  });

  const starBtn = header.querySelector<HTMLButtonElement>('#header-star-btn')!;
  starBtn.addEventListener('click', () => {
    const nowFavorite = toggleFavorite(tool.id);
    starBtn.classList.toggle('is-starred', nowFavorite);
    starBtn.setAttribute('aria-pressed', String(nowFavorite));
    starBtn.setAttribute('aria-label', nowFavorite ? 'Remove from favorites' : 'Add to favorites');
  });

  return header;
}

function handleShortcut(e: KeyboardEvent, session: ToolSession): void {
  if (e.key === 'Escape') {
    if (isShortcutsModalOpen()) {
      hideShortcutsModal();
    } else {
      releaseDownload(session);
      window.location.hash = '#/';
    }
    return;
  }

  if (e.key === '?' && !isInputFocused()) {
    e.preventDefault();
    if (isShortcutsModalOpen()) hideShortcutsModal();
    else showShortcutsModal();
    return;
  }

  if (e.key === 'Enter' && !isInputFocused()) {
    document.getElementById('process-btn')?.click();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isInputFocused()) {
    e.preventDefault();
    renderDropState(session);
  }
}

/**
 * Whether a single-file tool can also process several files in one go.
 *
 * Tools with an interactive panel are excluded: a crop box or page order drawn
 * from the first file means nothing for the rest.
 */
function supportsBatch(tool: ToolSession['tool']): boolean {
  return !tool.multiple && !tool.skipDropZone && !tool.renderInteractivePanel;
}

/** Empty state: the drop zone, or straight to the button for input-less tools. */
export function renderDropState(session: ToolSession): void {
  const { tool, workArea } = session;
  releaseDownload(session);
  clearElement(workArea);

  session.files = [];
  session.options = defaultOptions(tool);

  if (tool.skipDropZone) {
    workArea.appendChild(buildProcessRow(session));
    return;
  }

  const acceptsMany = tool.multiple || supportsBatch(tool);

  workArea.appendChild(
    createDropZone({
      acceptedTypes: tool.acceptedTypes,
      multiple: acceptsMany,
      color: tool.color,
      maxWarnBytes: tool.maxWarnBytes,
      onFiles: (files) => {
        session.files = tool.multiple
          ? [...session.files, ...files]
          : acceptsMany
            ? [...files]
            : [files[0]];
        renderFilesSelected(session);
      },
    })
  );
}

export function renderFilesSelected(session: ToolSession): void {
  const { workArea } = session;
  const count = session.files.length;
  announce(`${count} file${count === 1 ? '' : 's'} selected. Ready to process.`);
  clearElement(workArea);
  appendAddMoreZone(session);
  workArea.appendChild(buildFileList(session));
  workArea.appendChild(buildProcessRow(session));
}

function appendAddMoreZone(session: ToolSession): void {
  const { tool, workArea } = session;
  if (!tool.multiple && !supportsBatch(tool)) return;

  const isBatch = !tool.multiple;

  const zone = createDropZone({
    acceptedTypes: tool.acceptedTypes,
    multiple: true,
    color: tool.color,
    maxWarnBytes: tool.maxWarnBytes,
    onFiles: (files) => {
      session.files = [...session.files, ...files];
      renderFilesSelected(session);
    },
  });

  zone.style.minHeight = isBatch ? '80px' : '120px';
  zone.style.padding = isBatch ? '16px' : '24px';

  const title = zone.querySelector('.dropzone__title');
  if (title) title.textContent = isBatch ? 'Add Files for Batch' : 'Add More Files';
  const subtitle = zone.querySelector('.dropzone__subtitle');
  if (subtitle) subtitle.textContent = '';

  workArea.appendChild(zone);
}

function buildFileList(session: ToolSession): HTMLElement {
  return createFileList(
    [...session.files],
    (index) => {
      session.files = session.files.filter((_, i) => i !== index);
      if (session.files.length === 0) renderDropState(session);
      else renderFilesSelected(session);
    },
    session.tool.multiple
      ? (reordered) => {
          session.files = reordered;
        }
      : undefined
  );
}

function buildProcessRow(session: ToolSession): HTMLElement {
  const row = document.createElement('div');
  row.className = 'process-btn-row';

  const button = document.createElement('button');
  button.id = 'process-btn';
  button.type = 'button';

  const enable = () => {
    button.disabled = false;
    button.className = 'process-btn process-btn--ready';
    button.innerHTML = `${PLAY_ICON} ${processButtonLabel(session.tool, session.files.length)}`;
  };

  mountOptionsPanel(session, button, enable);
  button.addEventListener('click', () => {
    setBusy(button, 'Processing...');
    if (!session.tool.multiple && session.files.length > 1) void runBatch(session);
    else void runSingle(session);
  });

  row.appendChild(button);
  return row;
}

function setBusy(button: HTMLButtonElement, label: string): void {
  button.disabled = true;
  button.className = 'process-btn process-btn--loading';
  button.innerHTML = `<span class="process-btn__spinner" aria-hidden="true"></span> ${label}`;
}

function mountOptionsPanel(
  session: ToolSession,
  button: HTMLButtonElement,
  enable: () => void
): void {
  const { tool, workArea } = session;

  const insertBeforeButtonRow = (el: HTMLElement) => {
    const row = workArea.querySelector('.process-btn-row');
    if (row) workArea.insertBefore(el, row);
    else workArea.appendChild(el);
  };

  const mountStaticPanel = () => {
    if (tool.options && tool.options.length > 0) {
      insertBeforeButtonRow(createOptionsPanel(tool.options, session.options));
    }
  };

  if (!tool.renderInteractivePanel) {
    if (tool.options && tool.options.length > 0) {
      workArea.appendChild(createOptionsPanel(tool.options, session.options));
    }
    enable();
    return;
  }

  setBusy(button, 'Loading...');
  tool
    .renderInteractivePanel([...session.files], session.options)
    .then((el) => {
      insertBeforeButtonRow(el);
      enable();
    })
    .catch(() => {
      // A panel that cannot render (unreadable PDF, say) falls back to the
      // plain option list rather than leaving the page unusable.
      mountStaticPanel();
      enable();
    });
}
