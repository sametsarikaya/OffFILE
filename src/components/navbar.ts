import { getToolsByCategory, categories } from '../tools/registry';
import logoUrl from '../assets/OffFile_Logo.svg?url';
import nameUrl from '../assets/OffFile_Name.svg?url';

let navbarDocumentClickHandler: ((e: MouseEvent) => void) | null = null;

interface NavbarOptions {
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchInput?: (query: string) => void;
}

export function createNavbar(options: NavbarOptions = {}): HTMLElement {
  const { searchValue = '', searchPlaceholder = 'Search tools...', onSearchInput } = options;
  const nav = document.createElement('nav');
  nav.className = 'navbar';
  nav.id = 'main-navbar';

  const hash = window.location.hash || '#/';
  const currentToolId = hash.startsWith('#/tool/') ? hash.replace('#/tool/', '') : null;
  const activeCategoryId = currentToolId
    ? categories.find((cat) => getToolsByCategory(cat.id).some((tool) => tool.id === currentToolId))?.id ?? null
    : null;

  nav.innerHTML = `
    <div class="navbar__inner">
      <!-- Logo -->
      <a class="navbar__logo" href="#/" id="nav-logo" aria-label="OffFILE - home page">
        <img class="navbar__logo-img" src="${logoUrl}" alt="" draggable="false">
        <img class="navbar__logo-name" src="${nameUrl}" alt="OffFile" draggable="false">
      </a>

      <!-- Hamburger (mobile) -->
      <button class="navbar__hamburger" id="nav-hamburger" aria-label="Toggle menu" aria-controls="nav-links" aria-expanded="false" type="button">
        <span></span><span></span><span></span>
      </button>

      <!-- Nav Links -->
      <div class="navbar__nav" id="nav-links">
        ${categories.map((cat) => {
          const tools = getToolsByCategory(cat.id);
          return `
          <div class="navbar__dropdown ${activeCategoryId === cat.id ? 'is-active' : ''}" data-cat="${cat.id}">
            <button class="navbar__nav-btn" type="button" aria-haspopup="true" aria-expanded="false">
              ${cat.short} TOOLS
              <svg class="navbar__chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="navbar__dropdown-menu">
              <div class="navbar__dropdown-grid">
                ${tools.map((t) => `
                  <a class="navbar__dropdown-item" href="#/tool/${t.id}">
                    <span class="navbar__dropdown-item-icon" style="background:${t.color}20; color:${t.color}">
                      ${t.icon}
                    </span>
                    <span class="navbar__dropdown-item-text">${t.title}</span>
                  </a>
                `).join('')}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div class="navbar__search" role="search">
        <input
          class="navbar__search-input"
          id="nav-search-input"
          type="search"
          placeholder="${searchPlaceholder}"
          autocomplete="off"
          spellcheck="false"
          aria-label="Search tools"
        />
      </div>

      <!-- Actions -->
      <div class="navbar__actions">
        <button class="navbar__theme-btn" id="theme-toggle-btn" type="button" aria-label="Change theme" aria-pressed="false">
          <!-- Moon: visible in light mode → click to go dark -->
          <svg class="navbar__theme-icon navbar__theme-icon--moon" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <!-- Sun: visible in dark mode → click to go light -->
          <svg class="navbar__theme-icon navbar__theme-icon--sun" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </button>
        <div class="navbar__privacy" id="privacy-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          100% Private
        </div>
      </div>
    </div>
    <!-- accent line -->
    <div class="navbar__accent"></div>
  `;

  // Logo: block right-click / context menu so images can't be saved separately
  const navLogo = nav.querySelector('#nav-logo') as HTMLAnchorElement;
  navLogo.addEventListener('contextmenu', (e) => e.preventDefault());

  const searchInput = nav.querySelector('#nav-search-input') as HTMLInputElement;
  searchInput.value = searchValue;
  searchInput.addEventListener('input', () => {
    onSearchInput?.(searchInput.value);
  });

  // Theme toggle
  const themeBtn = nav.querySelector('#theme-toggle-btn') as HTMLButtonElement;
  const applyTheme = (dark: boolean) => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('ff-theme', dark ? 'dark' : 'light');
  };
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const syncThemeA11y = () => {
    const dark = isDark();
    themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };

  syncThemeA11y();

  themeBtn.addEventListener('click', () => {
    themeBtn.classList.remove('is-switching');
    // Force reflow so repeated clicks re-trigger the animation class.
    void themeBtn.offsetWidth;
    themeBtn.classList.add('is-switching');
    applyTheme(!isDark());
    syncThemeA11y();
    window.setTimeout(() => themeBtn.classList.remove('is-switching'), 460);
  });

  const closeAllDropdowns = (): void => {
    nav.querySelectorAll<HTMLElement>('.navbar__dropdown').forEach((d) => {
      d.classList.remove('is-open');
      const dBtn = d.querySelector('.navbar__nav-btn');
      dBtn?.setAttribute('aria-expanded', 'false');
    });
  };

  // Dropdown logic - hover + click
  nav.querySelectorAll<HTMLElement>('.navbar__dropdown').forEach((dd) => {
    const btn = dd.querySelector('.navbar__nav-btn') as HTMLButtonElement;
    let closeTimer: ReturnType<typeof setTimeout>;

    const open = () => {
      closeAllDropdowns();
      dd.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      dd.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    };

    dd.addEventListener('mouseenter', () => { clearTimeout(closeTimer); open(); });
    dd.addEventListener('mouseleave', () => { closeTimer = setTimeout(close, 150); });
    btn.addEventListener('click', () => dd.classList.contains('is-open') ? close() : open());
  });

  // Close dropdown when clicking a link
  nav.querySelectorAll('.navbar__dropdown-item').forEach((link) => {
    link.addEventListener('click', () => {
      closeAllDropdowns();
    });
  });

  // Mobile hamburger
  const hamburger = nav.querySelector('#nav-hamburger') as HTMLButtonElement;
  const navLinks = nav.querySelector('#nav-links') as HTMLElement;
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-mobile-open');
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Close on outside click
  if (navbarDocumentClickHandler) {
    document.removeEventListener('click', navbarDocumentClickHandler);
  }

  navbarDocumentClickHandler = (e: MouseEvent) => {
    if (!nav.contains(e.target as Node)) {
      closeAllDropdowns();
      navLinks.classList.remove('is-mobile-open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  };

  document.addEventListener('click', navbarDocumentClickHandler);

  return nav;
}
