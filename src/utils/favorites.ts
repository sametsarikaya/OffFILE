const KEY = 'ff-favorites';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function save(favs: Set<string>): void {
  localStorage.setItem(KEY, JSON.stringify([...favs]));
}

export function isFavorite(id: string): boolean {
  return load().has(id);
}

/** Toggle and return the new state (true = now favorited). */
export function toggleFavorite(id: string): boolean {
  const favs = load();
  if (favs.has(id)) {
    favs.delete(id);
  } else {
    favs.add(id);
  }
  save(favs);
  return favs.has(id);
}

export function getFavoriteIds(): string[] {
  return [...load()];
}
