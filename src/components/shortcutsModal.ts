const SHORTCUTS: { key: string; desc: string }[] = [
  { key: '?',         desc: 'Open/close the shortcuts panel' },
  { key: 'Esc',       desc: 'Go home / close the modal' },
  { key: 'Enter',     desc: 'Start processing (when a file is selected)' },
  { key: 'Drag & Drop', desc: 'Drop a file anywhere on the page' },
  { key: 'Tab',       desc: 'Navigate between controls' },
  { key: 'Space',     desc: 'Run the focused tool card' },
];

let modalEl: HTMLElement | null = null;

export function showShortcutsModal(): void {
  if (modalEl) return;

  const overlay = document.createElement('div');
  overlay.className = 'shortcuts-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Keyboard shortcuts');

  overlay.innerHTML = `
    <div class="shortcuts-modal">
      <div class="shortcuts-modal__header">
        <h2 class="shortcuts-modal__title">Keyboard Shortcuts</h2>
        <button class="shortcuts-modal__close" id="shortcuts-close" type="button" aria-label="Close shortcuts">
          <svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <table class="shortcuts-modal__table">
        <tbody>
          ${SHORTCUTS.map((s) => `
            <tr>
              <td><kbd class="shortcuts-modal__key">${s.key}</kbd></td>
              <td class="shortcuts-modal__desc">${s.desc}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p class="shortcuts-modal__hint">Press <kbd class="shortcuts-modal__key">Esc</kbd> or click outside to close</p>
    </div>
  `;

  const close = () => hideShortcutsModal();

  overlay.querySelector('#shortcuts-close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
  modalEl = overlay;

  requestAnimationFrame(() => overlay.classList.add('is-visible'));
}

export function hideShortcutsModal(): void {
  if (!modalEl) return;
  modalEl.classList.remove('is-visible');
  modalEl.addEventListener('transitionend', () => {
    modalEl?.remove();
    modalEl = null;
  }, { once: true });
}

export function isShortcutsModalOpen(): boolean {
  return modalEl !== null;
}
