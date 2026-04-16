/** Maps file extensions to accepted MIME types */
const EXT_TO_MIME: Record<string, string[]> = {
  pdf:      ['application/pdf'],
  png:      ['image/png'],
  jpg:      ['image/jpeg'],
  jpeg:     ['image/jpeg'],
  webp:     ['image/webp'],
  bmp:      ['image/bmp', 'image/x-bmp'],
  svg:      ['image/svg+xml'],
  gif:      ['image/gif'],
};

/**
 * Given an acceptedTypes string like ".pdf,.png,.jpg",
 * returns the set of allowed MIME types.
 */
export function getMimesForAcceptedTypes(acceptedTypes: string): Set<string> {
  const mimes = new Set<string>();
  acceptedTypes.split(',').forEach((part) => {
    const ext = part.trim().replace(/^\./, '').toLowerCase();
    const mapped = EXT_TO_MIME[ext];
    if (mapped) mapped.forEach((m) => mimes.add(m));
  });
  return mimes;
}

/**
 * Returns true if the file's MIME type matches the accepted types.
 * Falls back to true if file.type is empty (some OS/browser combos omit it).
 */
export function isFileTypeAllowed(file: File, acceptedTypes: string): boolean {
  if (!file.type) return true; // can't determine - let the tool handle it
  const allowed = getMimesForAcceptedTypes(acceptedTypes);
  return allowed.has(file.type);
}
