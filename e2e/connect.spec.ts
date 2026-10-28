import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

test('two devices: remote pause, listen here and lyrics', async ({ page, browser }, info) => {
  test.skip(info.project.name === 'mobile', 'Runs once; it opens its own second device.');
  test.setTimeout(150_000);
  await signIn(page, info);

  // The second device shares the account cookies but is its own tab.
  const phone = await browser.newPage({ storageState: await page.context().storageState() });
  await phone.goto('/');

  await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
  const row = page.locator('main ol li').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole('button', { name: /^Play / }).click();

  const pcBar = page.locator('footer');
  const phoneBar = phone.locator('footer');
  await expect(pcBar.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });

  // The phone mirrors the PC and shows where music plays.
  await expect(phoneBar).toContainText('Playing on', { timeout: 15_000 });
  await expect(phoneBar.getByRole('button', { name: 'Pause' })).toBeVisible();

  // Let it play long enough that resuming from 0:00 would be noticeable.
  const pcElapsed = pcBar.locator('span.w-10').first();
  await expect
    .poll(async () => (await pcElapsed.textContent()) ?? '0:00', { timeout: 30_000 })
    .toMatch(/^0:[1-5]\d$/);

  // Pausing on the phone pauses the PC.
  await phoneBar.getByRole('button', { name: 'Pause' }).click();
  // The remote shows the pause at once, without waiting for the PC's report.
  await expect(phoneBar.getByRole('button', { name: 'Play', exact: true })).toBeVisible({
    timeout: 500,
  });
  await expect(pcBar.getByRole('button', { name: 'Play', exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // "Listen here" moves playback to the phone.
  await phoneBar.getByRole('button', { name: 'Devices' }).click();
  await phone.screenshot({ path: 'test-results/screens/desktop-devices.png' });
  await phone.getByRole('button', { name: 'Listen here' }).click();
  await expect(phoneBar).not.toContainText('Playing on', { timeout: 15_000 });
  await expect(phoneBar.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });
  await expect(pcBar).toContainText('Playing on', { timeout: 15_000 });

  // Playback continues where the PC paused, not from the start.
  const elapsed = phoneBar.locator('span.w-10').first();
  await expect
    .poll(async () => (await elapsed.textContent()) ?? '0:00', { timeout: 15_000 })
    .not.toMatch(/^0:0\d$/);

  // Synced lyrics follow the song.
  await phone.getByRole('button', { name: 'Lyrics' }).click();
  await expect(phone.locator('[data-line]').first()).toBeVisible({ timeout: 30_000 });
  await phone.screenshot({ path: 'test-results/screens/desktop-lyrics.png' });

  await phone.close();
});
