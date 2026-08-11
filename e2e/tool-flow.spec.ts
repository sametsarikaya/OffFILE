import { test, expect } from '@playwright/test';
import { pngFile, pdfFile } from './fixtures';

/** Drops files onto the tool page's hidden file input. */
async function selectFiles(
  page: import('@playwright/test').Page,
  files: { name: string; mimeType: string; buffer: Buffer }[]
) {
  await page.locator('#dz-file-input').first().setInputFiles(files);
}

test.describe('end-to-end tool run', () => {
  test('processes an image and offers the result for download', async ({ page }) => {
    await page.goto('/#/tool/image-grayscale');
    await selectFiles(page, [pngFile()]);

    await expect(page.locator('#file-list')).toContainText('sample.png');

    const processBtn = page.locator('#process-btn');
    await expect(processBtn).toBeEnabled();
    await processBtn.click();

    const download = page.locator('#download-btn');
    await expect(download).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.download-area__title')).toHaveText('Done!');
    await expect(download).toHaveAttribute('download', /\.(png|jpe?g|webp)$/i);
  });

  test('actually downloads the produced file', async ({ page }) => {
    await page.goto('/#/tool/image-grayscale');
    await selectFiles(page, [pngFile()]);
    await page.locator('#process-btn').click();

    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#download-btn').click(),
    ]);
    expect(await download.failure()).toBeNull();
  });

  test('merges two PDFs', async ({ page }) => {
    await page.goto('/#/tool/merge-pdf');
    await selectFiles(page, [await pdfFile('a.pdf', 2), await pdfFile('b.pdf', 1)]);

    await expect(page.locator('#file-list')).toContainText('a.pdf');
    await expect(page.locator('#file-list')).toContainText('b.pdf');

    await page.locator('#process-btn').click();
    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#download-btn')).toHaveAttribute('download', /\.pdf$/i);
  });

  test('removes a selected file and returns to the drop zone when the last one goes', async ({
    page,
  }) => {
    await page.goto('/#/tool/image-grayscale');
    await selectFiles(page, [pngFile()]);
    await expect(page.locator('#file-list')).toBeVisible();

    await page.locator('.file-list__item-remove').first().click();
    await expect(page.locator('#drop-zone')).toBeVisible();
  });

  test('rejects a file whose type the tool does not accept', async ({ page }) => {
    await page.goto('/#/tool/merge-pdf');
    await selectFiles(page, [pngFile()]);

    await expect(page.locator('.toast--error')).toBeVisible();
    await expect(page.locator('#drop-zone')).toBeVisible();
    await expect(page.locator('#file-list')).toHaveCount(0);
  });

  test('starts over after a run', async ({ page }) => {
    await page.goto('/#/tool/image-grayscale');
    await selectFiles(page, [pngFile()]);
    await page.locator('#process-btn').click();
    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });

    await page.locator('#restart-btn').click();
    await expect(page.locator('#drop-zone')).toBeVisible();
  });

  test('generates a QR code without any file input', async ({ page }) => {
    await page.goto('/#/tool/qr-code');
    await expect(page.locator('#drop-zone')).toHaveCount(0);

    const textField = page.locator('#opt-text, [name="text"], input[type="text"]').first();
    await textField.fill('https://offfile.sametsarikaya.com');
    await page.locator('#process-btn').click();

    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
  });
});
