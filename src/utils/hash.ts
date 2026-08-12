/** Hash-route helpers. The app routes on `#/` and `#/tool/<id>`, with `?q=` for search. */

export function getHomeSearchQuery(hash: string): string {
  const queryMarkIndex = hash.indexOf('?');
  if (queryMarkIndex === -1) return '';
  const params = new URLSearchParams(hash.slice(queryMarkIndex + 1));
  return (params.get('q') ?? '').trim();
}

export function buildHomeHash(query: string): string {
  const trimmed = query.trim();
  return trimmed ? `#/?q=${encodeURIComponent(trimmed)}` : '#/';
}
