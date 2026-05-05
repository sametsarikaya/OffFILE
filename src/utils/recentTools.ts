const KEY = 'ff-recent';
const MAX = 6;

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function save(ids: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(ids));
}

/** Record a tool as recently used (moves to front, deduplicates, caps at MAX). */
export function recordRecentTool(id: string): void {
  const list = load().filter((x) => x !== id);
  list.unshift(id);
  save(list.slice(0, MAX));
}

export function getRecentToolIds(): string[] {
  return load();
}

export function clearRecentTools(): void {
  localStorage.removeItem(KEY);
}
