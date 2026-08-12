import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pngFile } from './fixtures';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Cards fade in; scanning mid-animation reports interpolated colours. */
async function settled(page: Page) {
  await page.waitForTimeout(1200);
}

async function violations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return result.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} nodes): ${v.help}`);
}

test.describe('WCAG 2.1 AA', () => {
  test('home page has no violations', async ({ page }) => {
    await page.goto('/');
    await settled(page);
    expect(await violations(page)).toEqual([]);
  });

  test('tool page has no violations', async ({ page }) => {
    await page.goto('/#/tool/image-resize');
    await settled(page);
    expect(await violations(page)).toEqual([]);
  });

  test('download state has no violations', async ({ page }) => {
    await page.goto('/#/tool/image-grayscale');
    await page.locator('#dz-file-input').first().setInputFiles([pngFile()]);
    await page.locator('#process-btn').click();
    await expect(page.locator('#download-btn')).toBeVisible({ timeout: 30_000 });
    await settled(page);
    expect(await violations(page)).toEqual([]);
  });

  test('error state has no violations', async ({ page }) => {
    // A PDF tool given a truncated PDF fails in the worker.
    await page.goto('/#/tool/merge-pdf');
    await page
      .locator('#dz-file-input')
      .first()
      .setInputFiles([
        { name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 broken') },
      ]);
    await page.locator('#process-btn').click();
    await expect(page.locator('#error-state')).toBeVisible({ timeout: 30_000 });
    await settled(page);
    expect(await violations(page)).toEqual([]);
  });

  test('shortcuts modal has no violations', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('?');
    await expect(page.locator('.shortcuts-modal')).toBeVisible();
    await settled(page);
    expect(await violations(page)).toEqual([]);
  });

  test('dark mode has no violations', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await settled(page);
    expect(await violations(page)).toEqual([]);
  });
});

test.describe('keyboard and screen reader support', () => {
  test('a skip link reaches the main content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page).toHaveURL(/#main-content/);
  });

  test('focus lands on the heading after navigating to a tool', async ({ page }) => {
    // On first paint focus stays at the document start so the skip link works;
    // a navigation moves it to the new page's heading.
    await page.goto('/');
    await page.locator('#tool-card-merge-pdf .tool-card__link').click();
    await expect(page.locator('h1.tool-header__title')).toBeFocused();
  });

  test('tool cards are reachable as links, not nested buttons', async ({ page }) => {
    await page.goto('/');

    const link = page.locator('#tool-card-merge-pdf .tool-card__link');
    await expect(link).toHaveAttribute('href', '#/tool/merge-pdf');

    await link.click();
    await expect(page.locator('.tool-header__title')).toHaveText('Merge PDF');
  });

  test('the star button stays independent of the card link', async ({ page }) => {
    await page.goto('/');

    await page.locator('#tool-card-merge-pdf .tool-card__star').click();

    // Toggling a favourite must not navigate.
    await expect(page).toHaveURL(/#\/$|\/$/);
    await expect(page.locator('#category-favorites')).toBeVisible();
  });

  test('the modal keeps Tab inside it and restores focus on close', async ({ page }) => {
    await page.goto('/#/tool/merge-pdf');
    await page.locator('#header-star-btn').focus();
    await page.keyboard.press('?');

    await expect(page.locator('.shortcuts-modal')).toBeVisible();
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');

    const insideModal = await page.evaluate(
      () => document.activeElement?.closest('.shortcuts-modal-overlay') !== null
    );
    expect(insideModal, 'Tab escaped the dialog').toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('#header-star-btn')).toBeFocused();
  });

  test('announces progress and completion in a live region', async ({ page }) => {
    await page.goto('/#/tool/image-grayscale');
    await page.locator('#dz-file-input').first().setInputFiles([pngFile()]);

    const live = page.locator('#a11y-live-region');
    await expect(live).toHaveText(/file selected/i);

    await page.locator('#process-btn').click();
    await expect(live).toHaveText(/ready to download/i, { timeout: 30_000 });
  });

  test('announces failures assertively', async ({ page }) => {
    await page.goto('/#/tool/merge-pdf');
    await page
      .locator('#dz-file-input')
      .first()
      .setInputFiles([
        { name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 broken') },
      ]);
    await page.locator('#process-btn').click();

    const live = page.locator('#a11y-live-region');
    await expect(live).toHaveText(/went wrong/i, { timeout: 30_000 });
    await expect(live).toHaveAttribute('aria-live', 'assertive');
  });
});
