import { escapeHtml } from '../utils/escapeHtml';
import { clearElement } from '../utils/dom';
import type { PaletteColor } from '../types';

interface PaletteData {
  source?: string;
  colors: PaletteColor[];
}

/** Above this luma a swatch needs dark text to stay readable. */
const LIGHT_SWATCH_LUMA = 140;

const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/>
  <line x1="12" y1="15" x2="12" y2="3"/>
</svg>`;

const IMAGE_ICON = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18"/>
  <circle cx="8.5" cy="8.5" r="1.5"/>
  <polyline points="21 15 16 10 5 21"/>
</svg>`;

/**
 * The palette tool returns JSON rather than a file, so its result is swatches
 * the user can copy, plus CSS and PNG exports.
 */
export async function showColorPaletteResult(
  workArea: HTMLElement,
  blob: Blob,
  onRestart: () => void
): Promise<void> {
  const data = await parsePalette(blob);

  clearElement(workArea);

  const area = document.createElement('div');
  area.className = 'palette-result';
  area.appendChild(createHeader(data.source));
  area.appendChild(createGrid(data.colors));
  area.appendChild(createActions(data.colors, onRestart));

  workArea.appendChild(area);
}

async function parsePalette(blob: Blob): Promise<PaletteData> {
  try {
    return JSON.parse(await blob.text()) as PaletteData;
  } catch {
    return { colors: [] };
  }
}

function createHeader(source: string | undefined): HTMLElement {
  const header = document.createElement('div');
  header.className = 'palette-result__header';
  header.innerHTML = `
    <span class="palette-result__title">Color Palette</span>
    <span class="palette-result__source">${escapeHtml(source ?? '')}</span>
  `;
  return header;
}

function createGrid(colors: PaletteColor[]): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'palette-result__grid';
  for (const color of colors) grid.appendChild(createSwatch(color));
  return grid;
}

function createSwatch({ hex, r, g, b }: PaletteColor): HTMLElement {
  const textColor = luma(r, g, b) > LIGHT_SWATCH_LUMA ? '#111111' : '#FFFFFF';

  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'palette-swatch';
  swatch.style.setProperty('--swatch-color', hex);
  swatch.title = `Click to copy ${hex}`;
  swatch.innerHTML = `
    <div class="palette-swatch__color" style="background:${escapeHtml(hex)}"></div>
    <div class="palette-swatch__info" style="color:${textColor};background:${escapeHtml(hex)}">
      <span class="palette-swatch__hex">${escapeHtml(hex)}</span>
      <span class="palette-swatch__rgb">rgb(${r}, ${g}, ${b})</span>
    </div>
  `;

  swatch.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(hex);
      flashCopied(swatch);
    } catch {
      // Clipboard permission denied; the hex is still on screen to copy by hand.
    }
  });

  return swatch;
}

function flashCopied(swatch: HTMLElement): void {
  const label = swatch.querySelector('.palette-swatch__hex');
  if (!label) return;

  const previous = label.textContent;
  label.textContent = 'Copied!';
  setTimeout(() => {
    label.textContent = previous;
  }, 1200);
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function createActions(colors: PaletteColor[], onRestart: () => void): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'palette-result__actions';

  actions.appendChild(
    createActionButton(`${DOWNLOAD_ICON} Download as CSS Variables`, () => {
      const vars = colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n');
      saveBlob(new Blob([`:root {\n${vars}\n}\n`], { type: 'text/css' }), 'palette.css');
    })
  );

  actions.appendChild(
    createActionButton(`${IMAGE_ICON} Export Palette PNG`, () => {
      void exportPalettePng(colors);
    })
  );

  const restart = document.createElement('button');
  restart.type = 'button';
  restart.className = 'restart-btn';
  restart.textContent = 'Start Over';
  restart.addEventListener('click', onRestart);
  actions.appendChild(restart);

  return actions;
}

function createActionButton(html: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'download-btn';
  button.innerHTML = html;
  button.addEventListener('click', onClick);
  return button;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const PNG_LAYOUT = {
  maxColumns: 5,
  swatchWidth: 160,
  swatchHeight: 128,
  padding: 12,
  titleHeight: 48,
  background: '#f5f0de',
  ink: '#0a0a0a',
} as const;

async function exportPalettePng(colors: PaletteColor[]): Promise<void> {
  if (colors.length === 0) return;

  const { maxColumns, swatchWidth, swatchHeight, padding, titleHeight } = PNG_LAYOUT;
  const columns = Math.min(colors.length, maxColumns);
  const rows = Math.ceil(colors.length / columns);

  const canvas = document.createElement('canvas');
  canvas.width = columns * swatchWidth + (columns + 1) * padding;
  canvas.height = rows * swatchHeight + (rows + 1) * padding + titleHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = PNG_LAYOUT.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = PNG_LAYOUT.ink;
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('COLOR PALETTE', canvas.width / 2, 32);

  colors.forEach(({ hex, r, g, b }, i) => {
    const x = padding + (i % columns) * (swatchWidth + padding);
    const y = titleHeight + padding + Math.floor(i / columns) * (swatchHeight + padding);

    ctx.fillStyle = PNG_LAYOUT.ink;
    ctx.fillRect(x - 2, y - 2, swatchWidth + 4, swatchHeight + 4);

    ctx.fillStyle = hex;
    ctx.fillRect(x, y, swatchWidth, swatchHeight);

    ctx.fillStyle = luma(r, g, b) > LIGHT_SWATCH_LUMA ? '#111111' : '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(hex.toUpperCase(), x + swatchWidth / 2, y + swatchHeight - 18);
    ctx.font = '11px monospace';
    ctx.fillText(`rgb(${r},${g},${b})`, x + swatchWidth / 2, y + swatchHeight - 4);
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
  if (blob) saveBlob(blob, 'palette.png');
}
