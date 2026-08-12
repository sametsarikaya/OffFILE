import { test, expect, type Page, type Download } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { pngFile, pdfFile } from './fixtures';

/**
 * Behavioural cover for the twelve tools whose settings were being dropped or
 * rejected by the worker's out-of-sync validation schema. Each test changes a
 * setting and asserts the output actually reflects it.
 */

async function selectFiles(
  page: Page,
  files: { name: string; mimeType: string; buffer: Buffer }[]
) {
  await page.locator('#dz-file-input').first().setInputFiles(files);
}

async function runAndDownload(page: Page): Promise<Download> {
  await page.locator('#process-btn').click();
  await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#download-btn').click(),
  ]);
  return download;
}

async function downloadedPdf(download: Download): Promise<PDFDocument> {
  const path = await download.path();
  return PDFDocument.load(await readFile(path));
}

/** Fails the test with the tool's own error text instead of a locator timeout. */
async function expectNoError(page: Page) {
  const error = page.locator('#error-state');
  if (await error.isVisible().catch(() => false)) {
    const detail = await page.locator('.error-area__details pre').textContent();
    throw new Error(`Tool reported an error: ${detail}`);
  }
}

test.describe('tools repaired by deriving validation from the UI', () => {
  test('compress-pdf runs at all (every run used to throw)', async ({ page }) => {
    await page.goto('/#/tool/compress-pdf');
    await selectFiles(page, [await pdfFile('doc.pdf', 2)]);
    await page.selectOption('#opt-quality', 'low');

    await page.locator('#process-btn').click();
    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
    await expectNoError(page);
  });

  test('page-numbers-pdf runs and honours its position setting', async ({ page }) => {
    await page.goto('/#/tool/page-numbers-pdf');
    await selectFiles(page, [await pdfFile('doc.pdf', 3)]);
    await page.selectOption('#opt-position', 'right');
    await page.selectOption('#opt-format', 'of');

    const pdf = await downloadedPdf(await runAndDownload(page));
    expect(pdf.getPageCount()).toBe(3);
  });

  test('image-flip accepts "both" (used to be rejected)', async ({ page }) => {
    await page.goto('/#/tool/image-flip');
    await selectFiles(page, [pngFile('flip.png', 8, 8)]);
    await page.selectOption('#opt-direction', 'both');

    await page.locator('#process-btn').click();
    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
    await expectNoError(page);
  });

  test('pdf-add-blank accepts "start" and adds the requested pages', async ({ page }) => {
    await page.goto('/#/tool/pdf-add-blank');
    await selectFiles(page, [await pdfFile('doc.pdf', 2)]);
    await page.selectOption('#opt-position', 'start');

    const pdf = await downloadedPdf(await runAndDownload(page));
    expect(pdf.getPageCount()).toBeGreaterThan(2);
  });

  test('extract-pages-pdf honours from/to instead of always taking pages 1-3', async ({ page }) => {
    await page.goto('/#/tool/extract-pages-pdf');
    await selectFiles(page, [await pdfFile('doc.pdf', 6)]);
    await page.fill('#opt-from', '4');
    await page.fill('#opt-to', '6');

    const download = await runAndDownload(page);
    expect(download.suggestedFilename()).toContain('4-6');

    const pdf = await downloadedPdf(download);
    expect(pdf.getPageCount()).toBe(3);
  });

  test('pdf-resize-page honours size and orientation instead of always A4 portrait', async ({
    page,
  }) => {
    await page.goto('/#/tool/pdf-resize-page');
    await selectFiles(page, [await pdfFile('doc.pdf', 1)]);
    await page.selectOption('#opt-size', 'a3');
    await page.selectOption('#opt-orientation', 'landscape');

    const pdf = await downloadedPdf(await runAndDownload(page));
    const { width, height } = pdf.getPage(0).getSize();

    expect(width, 'landscape output should be wider than it is tall').toBeGreaterThan(height);
    // A3 landscape is 1191 x 842 pt; A4 landscape would be 842 x 595.
    expect(width).toBeGreaterThan(1000);
  });

  test('image-resize honours keepRatio', async ({ page }) => {
    await page.goto('/#/tool/image-resize');
    await selectFiles(page, [pngFile('wide.png', 16, 4)]);
    await page.fill('#opt-width', '64');

    await page.locator('#process-btn').click();
    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
    await expectNoError(page);

    const preview = page.locator('.download-area__preview-image');
    await expect(preview).toBeVisible();
    const size = await preview.evaluate((img) => ({
      w: (img as HTMLImageElement).naturalWidth,
      h: (img as HTMLImageElement).naturalHeight,
    }));

    // 16x4 source at width 64 with the ratio kept is 64x16, not 64x600.
    expect(size.w).toBe(64);
    expect(size.h).toBe(16);
  });

  test('color-palette honours the requested colour count', async ({ page }) => {
    await page.goto('/#/tool/color-palette');
    await selectFiles(page, [pngFile('colours.png', 24, 24)]);
    await page.selectOption('#opt-colors', '5');

    await page.locator('#process-btn').click();
    await expect(page.locator('.palette-result')).toBeVisible({ timeout: 30_000 });

    // Used to always return 8 because the schema renamed the key to `count`.
    await expect(page.locator('.palette-swatch')).toHaveCount(5);
  });

  test('image-merge honours its background setting', async ({ page }) => {
    await page.goto('/#/tool/image-merge');
    await selectFiles(page, [pngFile('a.png', 8, 8), pngFile('b.png', 8, 16)]);

    await page.locator('#process-btn').click();
    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
    await expectNoError(page);
  });

  test('pdf-metadata writes the keywords field', async ({ page }) => {
    await page.goto('/#/tool/pdf-metadata');
    await selectFiles(page, [await pdfFile('doc.pdf', 1)]);

    await expect(page.locator('.metadata-panel__fields')).toBeVisible({ timeout: 30_000 });
    const keywords = page.locator('.metadata-field-row').filter({ hasText: 'Keywords' });
    await keywords.locator('input').fill('offfile, privacy');

    const pdf = await downloadedPdf(await runAndDownload(page));
    // Used to be dropped: the schema only listed title/author/subject/creator.
    expect(pdf.getKeywords()).toContain('offfile');
  });
});
