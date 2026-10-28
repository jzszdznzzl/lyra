import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

test('the system theme is the default and follows the device live', async ({ page }, info) => {
  await signIn(page, info);
  await page.evaluate(() => localStorage.removeItem('lyra.theme'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f7f3f5');
});

test('mobile: the tab bar stays at the bottom while scrolling', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Mobile layout only.');
  await signIn(page, info);
  await page.goto('/explore');
  await expect(page.locator('main section h2').first()).toBeVisible({ timeout: 30_000 });

  const nav = page.locator('nav').last();
  const before = await nav.boundingBox();
  const viewport = page.viewportSize();

  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 2000);
  await page.touchscreen.tap(200, 300).catch(() => undefined);
  await page.locator('main').evaluate((main) => main.scrollBy(0, 2000));
  await page.waitForTimeout(500);

  const after = await nav.boundingBox();
  expect(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBe(0);
  expect(after?.y).toBe(before?.y);
  // Pinned to the bottom of the screen, not somewhere in the page.
  expect((after?.y ?? 0) + (after?.height ?? 0)).toBeGreaterThan((viewport?.height ?? 0) - 40);
});
