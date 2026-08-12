import type { Tool } from '../types';

/**
 * State for one visit to one tool page. Previously these lived as module-level
 * variables shared by every tool page, so a leftover file list or download URL
 * from one tool could surface on the next.
 */
export interface ToolSession {
  readonly tool: Tool;
  readonly workArea: HTMLElement;
  /** Replaced, never mutated, so a render always sees a consistent list. */
  files: readonly File[];
  options: Record<string, unknown>;
  /** Revokes the blob URLs of the current download state. */
  downloadCleanup: (() => void) | null;
}

export function createSession(tool: Tool, workArea: HTMLElement): ToolSession {
  return { tool, workArea, files: [], options: defaultOptions(tool), downloadCleanup: null };
}

export function defaultOptions(tool: Tool): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const option of tool.options ?? []) options[option.id] = option.defaultValue;
  return options;
}

/** Runs and clears the pending download cleanup, if any. */
export function releaseDownload(session: ToolSession): void {
  if (!session.downloadCleanup) return;
  session.downloadCleanup();
  session.downloadCleanup = null;
}

let active: ToolSession | null = null;

export function setActiveSession(session: ToolSession | null): void {
  active = session;
}

/** Called by the router before it replaces the page. */
export function releaseActiveSession(): void {
  if (!active) return;
  releaseDownload(active);
  active = null;
}
