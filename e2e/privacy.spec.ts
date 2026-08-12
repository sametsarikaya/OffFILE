import { test, expect, type Page } from '@playwright/test';
import { pngFile } from './fixtures';

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
