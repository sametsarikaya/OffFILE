import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the hero and every tool category', async ({ page }) => {
    await expect(page.locator('.hero__title')).toBeVisible();
    await expect(page.locator('#category-pdf')).toBeVisible();
    await expect(page.locator('#category-image')).toBeVisible();
    await expect(page.locator('#category-convert')).toBeVisible();
  });

  test('lists every registered tool as a card', async ({ page }) => {
    // Registry currently holds 37 tools; the count must never silently drop.
    expect(await page.locator('.tool-card').count()).toBeGreaterThanOrEqual(37);
  });

  test('filters tools by search and reflects the query in the URL', async ({ page }) => {
    await page.locator('#nav-search-input').fill('merge');

    // The result section is appended last; the category sections are hidden.
    await expect(page.locator('.category-section:visible .category-section__title')).toContainText(
      'result'
    );
    await expect(page).toHaveURL(/q=merge/);
    await expect(page.locator('#category-pdf')).toBeHidden();
    await expect(page.locator('#tool-card-merge-pdf:visible')).toBeVisible();
  });

  test('reports no results for an unknown query', async ({ page }) => {
    await page.locator('#nav-search-input').fill('zzzznope');
    await expect(page.locator('.category-section:visible .category-section__title')).toContainText(
      'No results'
    );
    await expect(page.locator('.tool-card:visible')).toHaveCount(0);
  });

  test('restores the full list when the search is cleared', async ({ page }) => {
    const search = page.locator('#nav-search-input');
    await search.fill('merge');
    await expect(page.locator('#category-pdf')).toBeHidden();

    await search.fill('');
    await expect(page.locator('#category-pdf')).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
  });

  test('opens a tool from a search result', async ({ page }) => {
    await page.locator('#nav-search-input').fill('grayscale');
    // NOTE: the hidden category card keeps its id, so the search copy is a
    // duplicate id in the DOM. Scope to the visible one until that is fixed.
    await page.locator('#tool-card-image-grayscale:visible').click();
    await expect(page.locator('.tool-header__title')).toHaveText('Image to Grayscale');
  });

  test('navigates into a tool and back', async ({ page }) => {
    await page.goto('/#/tool/merge-pdf');
    await expect(page.locator('.tool-header__title')).toHaveText('Merge PDF');
    await expect(page.locator('#drop-zone')).toBeVisible();

    await page.locator('#back-btn').click();
    await expect(page.locator('.hero__title')).toBeVisible();
  });

  test('redirects an unknown tool id to the home page', async ({ page }) => {
    await page.goto('/#/tool/does-not-exist');
    await expect(page.locator('.hero__title')).toBeVisible();
  });

  test('persists a favorited tool across a reload', async ({ page }) => {
    await page.goto('/#/tool/merge-pdf');
    await page.locator('#header-star-btn').click();
    await expect(page.locator('#header-star-btn')).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/');
    await expect(page.locator('#category-favorites')).toBeVisible();
  });
});
