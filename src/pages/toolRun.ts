import JSZip from 'jszip';
import { showProcessing, showDownload, showError } from '../components/processingUI';
import { runTool, runToolBatch, cancelCurrentTool } from '../worker/workerClient';
import { recordRecentTool } from '../utils/recentTools';
import { delay } from '../utils/dom';
import type { Tool } from '../types';
import type { ToolSession } from './toolSession';
import { renderDropState, renderFilesSelected } from './toolPage';
import { showColorPaletteResult } from './paletteResult';

/** Tools whose output is worth comparing against the input size. */
const COMPARISON_TOOL_IDS = new Set(['compress-pdf', 'image-compress', 'strip-metadata']);

/** A short pause so the progress UI is visible even for instant tools. */
const PROGRESS_SETTLE_MS = 300;

export async function runSingle(session: ToolSession): Promise<void> {
  const { tool, workArea } = session;
  const files = [...session.files];
  const options = { ...session.options };
  const inputBytes = totalBytes(files);

  const { updateProgress } = showProcessing(workArea, () => {
    cancelCurrentTool();
    renderDropState(session);
  });

  try {
    await delay(PROGRESS_SETTLE_MS);
    const result = await runTool(tool.id, files, options, updateProgress);

    if (tool.resultType === 'color-palette-json') {
      void showColorPaletteResult(workArea, result.blob, () => renderDropState(session)).catch(
        (err) => reportFailure(session, err, 'Could not render palette.')
      );
      return;
    }

    const { cleanup } = showDownload(workArea, result.blob, result.filename, {
      onRestart: () => renderDropState(session),
      onProcessAgain: () => reRender(session),
      comparison: comparisonFor(tool.id, inputBytes, result.blob.size),
      canCopyText: isTextOutput(result.blob, result.filename),
      additionalDownloads: await extractZipEntries(result.blob, result.filename),
      enableShare: true,
    });

    recordRecentTool(tool.id);
    session.downloadCleanup = cleanup;
  } catch (err) {
    reportFailure(session, err);
  }
}

export async function runBatch(session: ToolSession): Promise<void> {
  const { tool, workArea } = session;
  const files = [...session.files];
  const options = { ...session.options };
  const inputBytes = totalBytes(files);
  let cancelled = false;

  const { updateProgress, updateStatus } = showProcessing(workArea, () => {
    cancelled = true;
    cancelCurrentTool();
    renderDropState(session);
  });

  updateStatus(`Processing file 1 of ${files.length}...`);

  try {
    await delay(PROGRESS_SETTLE_MS);
    const results = await runToolBatch(tool.id, files, options, updateProgress, (done, total) => {
      updateStatus(
        done < total ? `Processing file ${done + 1} of ${total}...` : 'Packaging results...'
      );
    });

    if (cancelled) return;

    const zip = new JSZip();
    for (const { blob, filename } of results) zip.file(filename, blob);
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    const { cleanup } = showDownload(workArea, zipBlob, `${tool.id}_batch.zip`, {
      onRestart: () => renderDropState(session),
      onProcessAgain: () => renderFilesSelected(session),
      comparison: comparisonFor(tool.id, inputBytes, totalBlobBytes(results)),
      additionalDownloads: results,
      enableShare: true,
    });

    recordRecentTool(tool.id);
    session.downloadCleanup = cleanup;
  } catch (err) {
    if (cancelled) return;
    reportFailure(session, err);
  }
}

/** Back to the state the user would want to retry from. */
function reRender(session: ToolSession): void {
  if (session.tool.skipDropZone) renderDropState(session);
  else renderFilesSelected(session);
}

function reportFailure(session: ToolSession, err: unknown, fallback?: string): void {
  if (err instanceof Error && err.message === 'Cancelled') return;

  const message = err instanceof Error ? err.message : (fallback ?? 'An unknown error occurred.');

  showError(session.workArea, message, {
    onRetry: () => reRender(session),
    onRestart: () => renderDropState(session),
  });
}

function totalBytes(files: readonly File[]): number {
  return files.reduce((acc, file) => acc + file.size, 0);
}

function totalBlobBytes(items: { blob: Blob }[]): number {
  return items.reduce((acc, item) => acc + item.blob.size, 0);
}

function comparisonFor(
  toolId: string,
  inputBytes: number,
  outputBytes: number
): { direction: 'smaller' | 'larger'; percent: number } | undefined {
  if (!COMPARISON_TOOL_IDS.has(toolId) || inputBytes <= 0) return undefined;

  const ratio = ((outputBytes - inputBytes) / inputBytes) * 100;
  if (!Number.isFinite(ratio)) return undefined;

  return { direction: ratio <= 0 ? 'smaller' : 'larger', percent: Math.abs(ratio) };
}

function isTextOutput(blob: Blob, filename: string): boolean {
  if (blob.type.startsWith('text/')) return true;
  return /\.(txt|md|csv|json|xml|html|css|js|ts)$/i.test(filename);
}

/** Offers the members of a ZIP result individually alongside the archive. */
async function extractZipEntries(
  blob: Blob,
  filename: string
): Promise<{ filename: string; blob: Blob }[]> {
  const isZip = blob.type === 'application/zip' || filename.toLowerCase().endsWith('.zip');
  if (!isZip) return [];

  try {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const entries: { filename: string; blob: Blob }[] = [];

    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      entries.push({ filename: name, blob: await entry.async('blob') });
    }

    return entries;
  } catch {
    // A result we cannot read as a ZIP is still downloadable as a whole.
    return [];
  }
}

export function processButtonLabel(tool: Tool, fileCount: number): string {
  const action = actionVerb(tool.id);
  return fileCount > 1 ? `${action} ${fileCount} Files` : `${action} File`;
}

function actionVerb(toolId: string): string {
  const verbs: [string, string][] = [
    ['merge', 'Merge'],
    ['split', 'Split'],
    ['compress', 'Compress'],
    ['extract', 'Extract'],
    ['rotate', 'Rotate'],
    ['resize', 'Resize'],
    ['crop', 'Crop'],
    ['watermark', 'Watermark'],
    ['metadata', 'Edit Metadata'],
  ];

  for (const [needle, verb] of verbs) {
    if (toolId.includes(needle)) return verb;
  }
  if (toolId.includes('add') || toolId.includes('remove')) return 'Update';
  if (toolId.includes('to-') || toolId.includes('convert')) return 'Convert';
  return 'Process';
}
