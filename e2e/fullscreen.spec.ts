import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signIn } from './account.ts';

async function playSong(page: Page, query: string) {
  await page.goto(`/search?q=${encodeURIComponent(query)}&filter=songs`);
  await page
    .locator('main ol li')
    .first()
    .getByRole('button', { name: /^Play / })
    .click({ timeout: 30_000 });
}

test('desktop: F opens the player, lyrics or video full screen, and its controls work', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'Keyboard shortcut on desktop.');
  test.setTimeout(150_000);
  await signIn(page, info);
  await playSong(page, 'blinding lights the weeknd');
  const bar = page.locator('footer');
  await expect(bar.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });

  const exit = page.getByRole('button', { name: 'Exit full screen' });

  await page.keyboard.press('f');
  await expect(exit).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/desktop-immersive-player.png' });

  // The pause button inside full screen pauses the music, not just the picture.
  const immersive = page.getByRole('dialog', { name: 'Full screen' });
  await immersive.getByRole('button', { name: 'Pause' }).click();
  await expect(immersive.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await immersive.getByRole('button', { name: 'Play', exact: true }).click();
  await page.keyboard.press('f');
  await expect(exit).toBeHidden();

  await page.locator('aside').getByRole('button', { name: 'Lyrics' }).click();
  await page.keyboard.press('f');
  await expect(immersive.locator('[data-line]').first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: 'test-results/screens/desktop-immersive-lyrics.png' });
  await exit.click();

  await page.locator('aside').getByRole('button', { name: 'Now playing' }).click();
  await page.locator('aside').getByRole('button', { name: 'Video', exact: true }).click();
  await expect(page.locator('aside video')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('f');
  await expect(immersive.locator('video')).toBeVisible();
  // Only the full-screen copy decodes.
  await expect(page.locator('video')).toHaveCount(1);
  await immersive.getByRole('button', { name: 'Pause' }).click({ force: true });
  await expect(bar.getByRole('button', { name: 'Play', exact: true })).toBeAttached();
});

test('mobile: the video is centred and full screen keeps responding', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Mobile layout only.');
  test.setTimeout(150_000);
  await signIn(page, info);
  await playSong(page, 'blinding lights the weeknd');
  await page.getByRole('button', { name: 'Open player' }).click();
  await page.getByRole('button', { name: 'Video', exact: true }).click();

  const video = page.locator('video');
  await expect(video).toBeVisible({ timeout: 30_000 });

  // Centred between the header and the controls, not stuck to the top.
  const box = await video.boundingBox();
  const header = await page.getByRole('button', { name: 'Close' }).boundingBox();
  const title = await page.locator('h2').last().boundingBox();
  const above = (box?.y ?? 0) - ((header?.y ?? 0) + (header?.height ?? 0));
  const below = (title?.y ?? 0) - ((box?.y ?? 0) + (box?.height ?? 0));
  expect(Math.abs(above - below)).toBeLessThan(60);
  await page.screenshot({ path: 'test-results/screens/mobile-video.png' });

  await page.getByRole('button', { name: 'Full screen', exact: true }).first().click();
  const immersive = page.getByRole('dialog', { name: 'Full screen' });
  await expect(immersive.locator('video')).toBeVisible();
  await immersive.getByRole('button', { name: 'Pause' }).click({ force: true });
  await expect(immersive.getByRole('button', { name: 'Play', exact: true })).toBeAttached();
  await immersive.getByRole('button', { name: 'Exit full screen' }).click({ force: true });
  await expect(immersive).toHaveCount(0);
});
