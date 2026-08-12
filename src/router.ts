import { renderHome } from './pages/home';
import { renderToolPage } from './pages/toolPage';
import { releaseActiveSession } from './pages/toolSession';
import { focusHeading } from './utils/a11y';

const app = document.getElementById('app')!;

const TOOL_ROUTE_PREFIX = '#/tool/';
/** Matches the CSS route-exit transition; the new page renders once it is done. */
const ROUTE_TRANSITION_MS = 110;

let hasRenderedRoute = false;
let transitionTimer: number | undefined;

export function initRouter(): void {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute(): void {
  // Blob URLs from a previous download would otherwise outlive their page.
  releaseActiveSession();

  const render = () => renderRoute(window.location.hash || '#/');

  if (!hasRenderedRoute || prefersReducedMotion()) {
    app.classList.remove('route-exit');
    app.classList.add('route-enter');
    render();
    hasRenderedRoute = true;
    return;
  }

  if (transitionTimer) window.clearTimeout(transitionTimer);

  app.classList.remove('route-enter');
  app.classList.add('route-exit');

  transitionTimer = window.setTimeout(() => {
    render();
    app.classList.remove('route-exit');
    app.classList.add('route-enter');
  }, ROUTE_TRANSITION_MS);
}

function renderRoute(hash: string): void {
  if (hash.startsWith(TOOL_ROUTE_PREFIX)) {
    renderToolPage(app, hash.slice(TOOL_ROUTE_PREFIX.length));
  } else {
    renderHome(app);
  }

  // Only on a navigation. Focusing a heading on first paint would jump the
  // skip link, which must be the first thing Tab reaches.
  if (hasRenderedRoute) focusHeading(app);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
