import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

// Talks to the real YT Music through the server, without a linked Google account.
test('browse home, search and open an album', async ({ page }, info) => {
  test.setTimeout(90_000);
  await signIn(page, info);

  await expect(page.locator('main section h2').first()).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      () =>
        page
          .locator('main section img')
          .first()
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      {
        timeout: 15_000,
      },
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: `test-results/screens/${info.project.name}-home.png` });

  await page.goto('/search?q=random%20access%20memories&filter=albums');
  const album = page.locator('a[href^="/album/"]').first();
  await expect(album).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `test-results/screens/${info.project.name}-search.png` });

  await album.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Random Access Memories/i, {
    timeout: 30_000,
  });
  await expect(page.locator('ol li').nth(5)).toBeVisible();
  await page.screenshot({ path: `test-results/screens/${info.project.name}-album.png` });
});
