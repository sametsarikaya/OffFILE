import type { Tool } from '../types';
import { escapeHtml } from '../utils/escapeHtml';
import { isFavorite, toggleFavorite } from '../utils/favorites';

/**
 * A card is a link with one extra control on it.
 *
 * It used to be a `div role="button"` wrapping the star button, which nests one
 * control inside another: screen readers announce a button whose children are
 * unreachable, and axe flags it. Now the title is a real link stretched over
 * the whole card by CSS, and the star sits above it - two siblings, each doing
 * one thing, both reachable by keyboard in a sensible order.
 */
export function createToolCard(tool: Tool, index = 0): HTMLElement {
  const card = document.createElement('div');
  card.className = 'tool-card';
  card.id = `tool-card-${tool.id}`;
  card.style.setProperty('--card-color', tool.color);
  card.style.setProperty('--card-tilt', index % 2 === 0 ? '-0.7deg' : '0.7deg');
  card.style.setProperty('--card-stagger', String(index));

  const starred = isFavorite(tool.id);

  card.innerHTML = `
    <button
      class="tool-card__star${starred ? ' is-starred' : ''}"
      data-tool-id="${escapeHtml(tool.id)}"
      aria-label="${starred ? 'Remove from favorites' : 'Add to favorites'}"
      aria-pressed="${starred}"
      type="button"
    >
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
    <div class="tool-card__icon" aria-hidden="true">
      ${tool.icon}<!-- trusted: tool.icon is a static SVG from the internal registry, never user input -->
    </div>
    <h3 class="tool-card__title">
      <a class="tool-card__link" href="#/tool/${escapeHtml(tool.id)}">${escapeHtml(tool.title)}</a>
    </h3>
    <p class="tool-card__desc">${escapeHtml(tool.description)}</p>
  `;

  const starBtn = card.querySelector<HTMLButtonElement>('.tool-card__star')!;
  starBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowFavorite = toggleFavorite(tool.id);
    starBtn.classList.toggle('is-starred', nowFavorite);
    starBtn.setAttribute('aria-pressed', String(nowFavorite));
    starBtn.setAttribute('aria-label', nowFavorite ? 'Remove from favorites' : 'Add to favorites');
    // The home page listens for this to re-render favourites and sync every
    // copy of this tool's star.
    card.dispatchEvent(
      new CustomEvent<string>('favorite-changed', { bubbles: true, detail: tool.id })
    );
  });

  return card;
}
