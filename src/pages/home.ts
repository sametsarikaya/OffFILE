import { createNavbar } from '../components/navbar';
import { createToolGrid } from '../components/toolGrid';
import { createFooter } from '../components/footer';
import {
  showShortcutsModal,
  hideShortcutsModal,
  isShortcutsModalOpen,
} from '../components/shortcutsModal';
import { getAllTools, getToolById, getToolsByCategory, categories } from '../tools/registry';
import { getFavoriteIds, isFavorite } from '../utils/favorites';
import { getRecentToolIds } from '../utils/recentTools';
import { getHomeSearchQuery, buildHomeHash } from '../utils/hash';
import { isInputFocused, onRouteKeyDown, clearElement } from '../utils/dom';
import type { Tool } from '../types';

const STAR_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
</svg>`;

const CLOCK_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="10"/>
  <polyline points="12 6 12 12 16 14"/>
</svg>`;

export function renderHome(app: HTMLElement): void {
  const initialQuery = getHomeSearchQuery(window.location.hash || '#/');

  clearElement(app);

  let applySearch = (_query: string): void => {};
  app.appendChild(
    createNavbar({
      searchValue: initialQuery,
      searchPlaceholder: `Search in ${getAllTools().length} tools...`,
      onSearchInput: (query) => applySearch(query),
    })
  );

  const main = document.createElement('main');
  main.className = 'main-content';

  const container = document.createElement('div');
  container.className = 'container';
  container.appendChild(createHero());

  const favoritesSlot = createSlot('favorites-slot');
  container.appendChild(favoritesSlot);
  renderFavorites(favoritesSlot);

  container.addEventListener('favorite-changed', (e) => {
    const toolId = (e as CustomEvent<string>).detail;
    renderFavorites(favoritesSlot);
    if (toolId) syncStarButtons(container, toolId);
  });

  const recentSlot = createSlot('recent-slot');
  container.appendChild(recentSlot);
  renderRecent(recentSlot);

  const categorySections = renderCategories(container);

  const footer = createFooter();
  container.appendChild(footer);

  applySearch = createSearchHandler({
    container,
    footer,
    hideWhileSearching: [favoritesSlot, recentSlot, ...categorySections],
  });
  if (initialQuery) applySearch(initialQuery);

  main.appendChild(container);
  app.appendChild(main);

  onRouteKeyDown((e) => {
    if (e.key === '?' && !isInputFocused()) {
      e.preventDefault();
      if (isShortcutsModalOpen()) hideShortcutsModal();
      else showShortcutsModal();
    }
    if (e.key === 'Escape' && isShortcutsModalOpen()) hideShortcutsModal();
  });
}

function createHero(): HTMLElement {
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
  return hero;
}

function createSlot(id: string): HTMLElement {
  const slot = document.createElement('div');
  slot.id = id;
  return slot;
}

function createSection(id: string, className: string, headingHtml: string, tools: Tool[]) {
  const section = document.createElement('section');
  section.className = className;
  section.id = id;

  const heading = document.createElement('h2');
  heading.className = 'category-section__title';
  heading.innerHTML = headingHtml;

  section.appendChild(heading);
  section.appendChild(createToolGrid(tools));
  return section;
}

function toolsFromIds(ids: string[]): Tool[] {
  return ids.map((id) => getToolById(id)).filter((t): t is Tool => t !== undefined);
}

function renderFavorites(slot: HTMLElement): void {
  clearElement(slot);
  const tools = toolsFromIds(getFavoriteIds());
  if (tools.length === 0) return;

  slot.appendChild(
    createSection(
      'category-favorites',
      'category-section favorites-section',
      `${STAR_ICON} Favorite Tools`,
      tools
    )
  );
}

function renderRecent(slot: HTMLElement): void {
  const tools = toolsFromIds(getRecentToolIds());
  if (tools.length === 0) return;

  slot.appendChild(
    createSection(
      'category-recent',
      'category-section recent-section',
      `${CLOCK_ICON} Recently Used`,
      tools
    )
  );
}

function renderCategories(container: HTMLElement): HTMLElement[] {
  const sections: HTMLElement[] = [];

  for (const category of categories) {
    const tools = getToolsByCategory(category.id);
    if (tools.length === 0) continue;

    const section = document.createElement('section');
    section.className = 'category-section';
    section.id = `category-${category.id}`;

    const heading = document.createElement('h2');
    heading.className = 'category-section__title';
    heading.textContent = category.label;

    section.appendChild(heading);
    section.appendChild(createToolGrid(tools));
    container.appendChild(section);
    sections.push(section);
  }

  return sections;
}

/** Keeps every copy of a tool's star button in step after a toggle. */
function syncStarButtons(container: HTMLElement, toolId: string): void {
  const starred = isFavorite(toolId);
  container
    .querySelectorAll<HTMLButtonElement>(`.tool-card__star[data-tool-id="${toolId}"]`)
    .forEach((btn) => {
      btn.classList.toggle('is-starred', starred);
      btn.setAttribute('aria-pressed', String(starred));
      btn.setAttribute('aria-label', starred ? 'Remove from favorites' : 'Add to favorites');
    });
}

interface SearchContext {
  container: HTMLElement;
  footer: HTMLElement;
  hideWhileSearching: HTMLElement[];
}

function createSearchHandler(ctx: SearchContext): (query: string) => void {
  let resultSection: HTMLElement | null = null;

  return (rawQuery: string) => {
    const query = rawQuery.trim();
    const needle = query.toLowerCase();

    resultSection?.remove();
    resultSection = null;

    // Sections are detached rather than hidden: hidden cards keep their ids,
    // and the search results render the same cards again - two elements with
    // one id.
    setSectionsHidden(ctx.hideWhileSearching, needle !== '');
    syncUrl(query);

    if (!needle) return;

    const matched = getAllTools().filter(
      (t) => t.title.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle)
    );

    resultSection = document.createElement('section');
    resultSection.className = 'category-section';
    resultSection.id = 'search-results';

    const heading = document.createElement('h2');
    heading.className = 'category-section__title';
    heading.textContent =
      matched.length > 0
        ? `${matched.length} result(s) for "${query}"`
        : `No results found for "${query}"`;
    resultSection.appendChild(heading);

    if (matched.length > 0) resultSection.appendChild(createToolGrid(matched));

    ctx.container.insertBefore(resultSection, ctx.footer);
  };
}

/**
 * Detaches sections while a search is running so their tool cards leave the
 * DOM entirely, then puts them back in place.
 */
function setSectionsHidden(sections: HTMLElement[], hidden: boolean): void {
  for (const section of sections) {
    if (hidden) {
      if (section.isConnected) {
        const placeholder = document.createComment(`hidden:${section.id}`);
        section.replaceWith(placeholder);
        hiddenAnchors.set(section, placeholder);
      }
    } else {
      const placeholder = hiddenAnchors.get(section);
      if (placeholder?.isConnected) {
        placeholder.replaceWith(section);
        hiddenAnchors.delete(section);
      }
    }
  }
}

const hiddenAnchors = new WeakMap<HTMLElement, Comment>();

function syncUrl(query: string): void {
  const target = buildHomeHash(query);
  if ((window.location.hash || '#/') !== target) {
    window.history.replaceState(null, '', target);
  }
}
