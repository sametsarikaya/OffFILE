import type { Tool } from '../types';
import { isFavorite, toggleFavorite } from '../utils/favorites';

export function createToolCard(tool: Tool, index = 0): HTMLElement {
  // div + role="button" avoids the ARIA violation of nesting <button> inside <article role="button">
  const card = document.createElement('div');
  card.className = 'tool-card';
  card.id = `tool-card-${tool.id}`;
  card.style.setProperty('--card-color', tool.color);
  card.style.setProperty('--card-tilt', index % 2 === 0 ? '-0.7deg' : '0.7deg');
  card.style.setProperty('--card-stagger', String(index));
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Open ${tool.title} tool`);

  const starred = isFavorite(tool.id);

  card.innerHTML = `
    <button
      class="tool-card__star${starred ? ' is-starred' : ''}"
      data-tool-id="${tool.id}"
      aria-label="${starred ? 'Remove from favorites' : 'Add to favorites'}"
      aria-pressed="${starred}"
      type="button"
    >
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
    <div class="tool-card__icon">
      ${tool.icon}<!-- trusted: tool.icon is a static SVG from the internal registry, never user input -->
    </div>
    <h3 class="tool-card__title">${tool.title}</h3>
    <p class="tool-card__desc">${tool.description}</p>
  `;

  const navigate = () => {
    window.location.hash = `#/tool/${tool.id}`;
  };

  // Star button - toggle favorite without navigating
  const starBtn = card.querySelector<HTMLButtonElement>('.tool-card__star')!;
  starBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowFav = toggleFavorite(tool.id);
    starBtn.classList.toggle('is-starred', nowFav);
    starBtn.setAttribute('aria-pressed', String(nowFav));
    starBtn.setAttribute('aria-label', nowFav ? 'Remove from favorites' : 'Add to favorites');
    // Bubble a custom event so the home page can re-render the favorites section and sync all star buttons.
    card.dispatchEvent(new CustomEvent<string>('favorite-changed', { bubbles: true, detail: tool.id }));
  });

  card.addEventListener('click', navigate);
  card.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate();
    }
  });

  return card;
}
