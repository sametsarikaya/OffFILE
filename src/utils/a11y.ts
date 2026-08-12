/**
 * Screen-reader plumbing for a page that rewrites itself in place.
 *
 * Routes and tool states replace the contents of the work area, which is
 * invisible to assistive technology: focus lands nowhere and nothing is
 * announced. These helpers give both a home.
 */

const LIVE_REGION_ID = 'a11y-live-region';

/** Politeness of an announcement: status for progress, alert for failures. */
type Urgency = 'polite' | 'assertive';

function liveRegion(): HTMLElement {
  const existing = document.getElementById(LIVE_REGION_ID);
  if (existing) return existing;

  const region = document.createElement('div');
  region.id = LIVE_REGION_ID;
  region.className = 'visually-hidden';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);
  return region;
}

/**
 * Announces a message to assistive technology.
 *
 * The region is cleared first: repeating identical text is otherwise ignored,
 * which would silence "Processing..." on a second run.
 */
export function announce(message: string, urgency: Urgency = 'polite'): void {
  const region = liveRegion();
  region.setAttribute('aria-live', urgency);
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
}

/**
 * Moves focus to a newly rendered heading so keyboard and screen-reader users
 * start at the top of the new content rather than back at the document root.
 */
export function focusHeading(container: HTMLElement): void {
  const heading = container.querySelector<HTMLElement>('h1, h2');
  if (!heading) return;

  // -1 keeps it out of the tab order; it is a focus target, not a control.
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

/**
 * Confines Tab to a dialog while it is open, and restores focus to whatever
 * opened it. Returns the teardown.
 */
export function trapFocus(dialog: HTMLElement): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const focusable = () =>
    [
      ...dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((el) => el.offsetParent !== null);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const items = focusable();
    if (items.length === 0) {
      e.preventDefault();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeyDown, true);
  focusable()[0]?.focus();

  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
    previouslyFocused?.focus?.();
  };
}
