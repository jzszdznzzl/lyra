import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

test('switches a song to its music video and keeps it in sync', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'The right panel shows the video on desktop.');
  test.setTimeout(150_000);
  await signIn(page, info);

  await page.goto('/search?q=blinding%20lights%20the%20weeknd&filter=songs');
  await page
    .locator('main ol li')
    .first()
    .getByRole('button', { name: /^Play / })
    .click({ timeout: 30_000 });
  const bar = page.locator('footer');
  await expect(bar.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });

  const panel = page.locator('aside').filter({ hasText: 'Now playing' });
  await panel.getByRole('button', { name: 'Video' }).click();

  const video = panel.locator('video');
  await expect(video).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState), {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(2);

  // The muted video follows the audio clock.
  await page.waitForTimeout(3000);
  const drift = await video.evaluate((element: HTMLVideoElement) => {
    const elapsed = document.querySelector('footer span.w-10')?.textContent ?? '0:00';
    const [minutes = '0', seconds = '0'] = elapsed.split(':');

    return Math.abs(element.currentTime - (Number(minutes) * 60 + Number(seconds)));
  });
  expect(drift).toBeLessThan(2);
  await page.screenshot({ path: 'test-results/screens/desktop-video.png' });
});
