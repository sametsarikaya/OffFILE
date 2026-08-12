/** True when the user is typing in an input, textarea, select or editable element. */
export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (el as HTMLElement).isContentEditable
  );
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Removes every child without the innerHTML round trip. */
export function clearElement(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Registers a keydown handler for the lifetime of the current route.
 * Routes replace the whole page, so handlers must not outlive them.
 */
export function onRouteKeyDown(handler: (e: KeyboardEvent) => void): void {
  document.addEventListener('keydown', handler);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', handler), {
    once: true,
  });
}
