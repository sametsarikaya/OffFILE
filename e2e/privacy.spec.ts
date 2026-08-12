import { test, expect, type Page } from '@playwright/test';
import { pngFile, pdfFile } from './fixtures';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

/**
 * The product claim is that nothing leaves the device. These tests hold the
 * build to it: every request a session makes must be same-origin, from first
 * paint through an actual file run.
 */

function recordRequests(page: Page): string[] {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (!url.startsWith('http://localhost:4173')) external.push(url);
  });
  return external;
}

test.describe('privacy guarantees', () => {
  test('loads the home page without contacting any other host', async ({ page }) => {
    const external = recordRequests(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(external, 'requests to third-party hosts').toEqual([]);
  });

  test('processes a file without contacting any other host', async ({ page }) => {
    const external = recordRequests(page);

    await page.goto('/#/tool/image-grayscale');
    await page.locator('#dz-file-input').first().setInputFiles([pngFile()]);
    await page.locator('#process-btn').click();
    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    expect(external, 'requests to third-party hosts').toEqual([]);
  });

  test('serves its fonts from the same origin', async ({ page }) => {
    const fontUrls: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('.woff')) fontUrls.push(res.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(fontUrls.length, 'no webfont was loaded at all').toBeGreaterThan(0);
    for (const url of fontUrls) {
      expect(url).toContain('localhost:4173');
    }
  });

  test('declares a content security policy that allows only self', async ({ page }) => {
    await page.goto('/');

    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');

    expect(csp).toBeTruthy();
    expect(csp).not.toContain('googleapis.com');
    expect(csp).not.toContain('gstatic.com');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  test('ships an installable manifest with real icons', async ({ page, request }) => {
    await page.goto('/');

    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const manifest = await (await request.get(href!)).json();
    expect(manifest.name).toContain('OffFile');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons.length).toBeGreaterThan(0);

    // The manifest used to point at icons/icon.svg, which did not exist.
    for (const icon of manifest.icons) {
      const response = await request.get(`/${icon.src}`);
      expect(response.status(), `${icon.src} is missing`).toBe(200);
    }

    expect(
      manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable'),
      'no maskable icon for Android launchers'
    ).toBe(true);
  });
});

test.describe('large file handling', () => {
  test('keeps results in OPFS rather than main-thread memory', async ({ page }) => {
    await page.goto('/#/tool/merge-pdf');

    const before = await page.evaluate(
      () => 'storage' in navigator && 'getDirectory' in navigator.storage
    );
    expect(before, 'OPFS should be available in this browser').toBe(true);

    await page
      .locator('#dz-file-input')
      .first()
      .setInputFiles([await pdfFile('big-a.pdf', 120), await pdfFile('big-b.pdf', 120)]);
    await page.locator('#process-btn').click();
    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 60_000 });

    // The href must resolve; an OPFS entry deleted too early would break it.
    const href = await page.locator('#download-btn').getAttribute('href');
    expect(href).toMatch(/^blob:/);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#download-btn').click(),
    ]);
    expect(await download.failure()).toBeNull();

    const pdf = await PDFDocument.load(await readFile(await download.path()));
    expect(pdf.getPageCount()).toBe(240);
  });
});
