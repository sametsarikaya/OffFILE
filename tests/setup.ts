import { beforeEach } from 'vitest';

/**
 * Node 26 exposes a global `localStorage` getter that yields `undefined` unless
 * the process was started with `--localstorage-file`. That getter shadows the
 * Storage instance jsdom installs, so anything reading `localStorage` inside a
 * test sees `undefined`. Install a spec-shaped in-memory Storage instead.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

function installStorage(name: 'localStorage' | 'sessionStorage'): void {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, name, {
    value: storage,
    configurable: true,
    writable: true,
  });
}

if (!globalThis.localStorage) installStorage('localStorage');
if (!globalThis.sessionStorage) installStorage('sessionStorage');

// Storage leaking between tests hides ordering bugs; start every test clean.
beforeEach(() => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});
