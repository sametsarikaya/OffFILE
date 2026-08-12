/**
 * Origin Private File System helpers.
 *
 * Results used to travel back from the worker as an ArrayBuffer and were then
 * wrapped in a Blob, which copies the bytes again on the main thread. For a
 * 100 MB PDF that meant the finished file existed twice in memory at once, on
 * top of whatever the tool needed to produce it.
 *
 * When OPFS is available the worker writes its result straight to disk and
 * sends back a filename; the main thread opens that file and hands the browser
 * a File it can stream from. Nothing large is held in JS memory on either side.
 *
 * Everything here degrades: if OPFS is missing or throws, callers fall back to
 * transferring the buffer as before.
 */

const RESULTS_DIR = 'offfile-results';

/**
 * Only worker contexts expose this, and TypeScript's DOM lib does not declare
 * it, so the shape we use is spelled out here.
 */
interface SyncAccessHandle {
  truncate(size: number): void;
  write(buffer: BufferSource, options?: { at?: number }): number;
  flush(): void;
  close(): void;
}

export function isOpfsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

async function resultsDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(RESULTS_DIR, { create: true });
}

/**
 * Writes bytes to OPFS and returns the name to fetch them back with.
 * Returns null when OPFS is unavailable, so the caller can transfer instead.
 */
export async function writeResult(name: string, data: ArrayBuffer): Promise<string | null> {
  if (!isOpfsSupported()) return null;

  try {
    const dir = await resultsDirectory();
    const handle = await dir.getFileHandle(name, { create: true });

    // Worker contexts get the synchronous handle, which avoids a second copy
    // through a WritableStream.
    const syncCapable = handle as FileSystemFileHandle & {
      createSyncAccessHandle?: () => Promise<SyncAccessHandle>;
    };
    if (typeof syncCapable.createSyncAccessHandle === 'function') {
      const access = await syncCapable.createSyncAccessHandle();
      try {
        access.truncate(0);
        access.write(new Uint8Array(data), { at: 0 });
        access.flush();
      } finally {
        access.close();
      }
      return name;
    }

    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return name;
  } catch {
    return null;
  }
}

/** Reads back a result written by the worker. */
export async function readResult(name: string, mime: string): Promise<File | null> {
  if (!isOpfsSupported()) return null;

  try {
    const dir = await resultsDirectory();
    const file = await (await dir.getFileHandle(name)).getFile();
    return new File([file], name, { type: mime });
  } catch {
    return null;
  }
}

export async function deleteResult(name: string): Promise<void> {
  if (!isOpfsSupported()) return;

  try {
    const dir = await resultsDirectory();
    await dir.removeEntry(name);
  } catch {
    // Already gone, or storage was cleared underneath us.
  }
}

/** Results older than this are assumed to be from an abandoned session. */
const STALE_AFTER_MS = 60 * 60 * 1000;

/**
 * Clears results left behind by an interrupted session - a crash or a closed
 * tab skips the per-download cleanup, and OPFS survives both.
 *
 * Deliberately age-based rather than wiping the directory: this runs at
 * startup, and a blanket delete would race a result the user is downloading
 * right now in another tab of the same origin.
 */
export async function purgeStaleResults(): Promise<void> {
  if (!isOpfsSupported()) return;

  try {
    const dir = await resultsDirectory();
    const cutoff = Date.now() - STALE_AFTER_MS;

    // TypeScript's DOM lib predates the async iteration helpers on the handle.
    const iterable = dir as FileSystemDirectoryHandle & {
      entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    };

    for await (const [name, handle] of iterable.entries()) {
      if (handle.kind !== 'file') continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      if (file.lastModified < cutoff) await dir.removeEntry(name);
    }
  } catch {
    // Nothing to purge, or the directory is not readable.
  }
}

/** Unique-enough name for one result; the directory is private to this origin. */
export function resultName(requestId: string, filename: string): string {
  const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  return `r${requestId}-${Date.now()}${extension}`;
}
