import { test, expect, type Page, type Download } from '@playwright/test';
import { PDFDocument, PDFDict, PDFName, StandardFonts } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { makePng } from './fixtures';

/**
 * Compress PDF offers two methods that differ in what they cost you. These
 * tests hold each to its promise: lossless must leave the text intact,
 * rasterise must actually shrink an image-heavy document.
 */

/** A PDF with real text on every page, so "is the text still there" is answerable. */
async function textPdf(pageCount = 6): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([420, 595]);
    page.drawText(`Findable marker page ${i + 1}`, { x: 40, y: 520, size: 18, font });
    for (let line = 0; line < 20; line++) {
      page.drawText(`Body line ${line} with enough words to make the stream worth packing`, {
        x: 40,
        y: 480 - line * 20,
        size: 9,
        font,
      });
    }
  }

  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

/** A PDF dominated by a large lossless image - the case rasterising is for. */
async function imagePdf(pageCount = 3): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(makePng(900, 900));

  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([600, 600]);
    page.drawImage(image, { x: 0, y: 0, width: 600, height: 600 });
  }

  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

async function runCompression(
  page: Page,
  source: Buffer,
  mode: string,
  quality?: string
): Promise<Download> {
  // Navigating to the same hash does not re-render, so start from home.
  await page.goto('/');
  await page.goto('/#/tool/compress-pdf');

  await page
    .locator('#dz-file-input')
    .first()
    .setInputFiles([{ name: 'doc.pdf', mimeType: 'application/pdf', buffer: source }]);

  await page.selectOption('#opt-mode', mode);
  if (quality) await page.selectOption('#opt-quality', quality);

  await page.locator('#process-btn').click();
  await expect(page.locator('#download-btn')).toBeVisible({ timeout: 60_000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#download-btn').click(),
  ]);
  return download;
}

/**
 * How many fonts the pages actually reference.
 *
 * Searching the raw bytes for "/Font" does not work: the output stores objects
 * in compressed streams, and pdf-lib writes an empty /Font dictionary on every
 * page regardless. Counting the entries distinguishes real text from that
 * placeholder.
 */
async function fontCount(bytes: Buffer): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  let total = 0;
  for (const page of doc.getPages()) {
    const fonts = page.node.Resources()?.lookup(PDFName.of('Font'), PDFDict);
    total += fonts ? fonts.keys().length : 0;
  }
  return total;
}

test.describe('Compress PDF methods', () => {
  test('lossless keeps the page count and the text', async ({ page }) => {
    const download = await runCompression(page, await textPdf(), 'lossless');
    const bytes = await readFile(await download.path());

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(6);
    expect(await fontCount(bytes), 'text was lost in lossless mode').toBeGreaterThan(0);
  });

  test('rasterise keeps the page count but drops the text layer', async ({ page }) => {
    const download = await runCompression(page, await textPdf(), 'raster', 'low');
    const bytes = await readFile(await download.path());

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(6);
    expect(await fontCount(bytes), 'rasterised output should carry no fonts').toBe(0);
  });

  test('rasterise shrinks an image-heavy document', async ({ page }) => {
    const source = await imagePdf();
    const download = await runCompression(page, source, 'raster', 'low');
    const bytes = await readFile(await download.path());

    expect(bytes.byteLength).toBeLessThan(source.byteLength);
  });

  test('rasterise at low quality is smaller than at high quality', async ({ page }) => {
    const source = await imagePdf();
    const low = await readFile(await (await runCompression(page, source, 'raster', 'low')).path());
    const high = await readFile(
      await (await runCompression(page, source, 'raster', 'high')).path()
    );

    expect(low.byteLength).toBeLessThan(high.byteLength);
  });

  test('lossless never returns a file larger than the original', async ({ page }) => {
    const source = await textPdf();
    const bytes = await readFile(await (await runCompression(page, source, 'lossless')).path());

    // Repacking an already-tight PDF can grow it; the tool hands back the input
    // rather than something worse.
    expect(bytes.byteLength).toBeLessThanOrEqual(source.byteLength);
  });

  test('reports the size change either way', async ({ page }) => {
    await runCompression(page, await imagePdf(), 'raster', 'low');
    await expect(page.locator('.download-area__compare')).toContainText('smaller');
  });
});
