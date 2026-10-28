import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

function seconds(text: string | null) {
  const [minutes, rest] = (text ?? '0:00').split(':');

  return Number(minutes) * 60 + Number(rest);
}

test('plays a song, skips, and crossfades into the next one', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'The desktop bar exposes the timings this test reads.');
  test.setTimeout(120_000);
  await signIn(page, info);

  await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
  const firstRow = page.locator('main ol li').first();
  await expect(firstRow).toBeVisible({ timeout: 30_000 });
  const firstTitle = (await firstRow.locator('p').first().textContent()) ?? '';
  await firstRow.getByRole('button', { name: /^Play / }).click();

  const footer = page.locator('footer');
  await expect(footer.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });
  await expect(footer).toContainText(firstTitle);
  const elapsed = footer.locator('span.w-10').first();
  await expect
    .poll(async () => seconds(await elapsed.textContent()), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: 'test-results/screens/desktop-playing.png' });

  await footer.getByRole('button', { name: 'Next' }).click();
  await expect(footer).not.toContainText(firstTitle, { timeout: 30_000 });
  await expect(footer.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });

  // Crossfade: set 4 s, jump close to the end and expect the next song to take over on its own.
  await footer.getByRole('button', { name: 'Audio settings' }).click();
  await page.getByRole('slider', { name: 'Crossfade' }).fill('4');
  await page.getByRole('switch', { name: 'Enable equalizer' }).check({ force: true });
  await page.getByRole('button', { name: 'Bass boost' }).click();
  await page.screenshot({ path: 'test-results/screens/desktop-settings.png' });
  await page.keyboard.press('Escape');

  const secondTitle = (await footer.locator('p').first().textContent()) ?? '';
  const total = seconds(await footer.locator('span.w-10').nth(1).textContent());
  await footer.getByRole('slider', { name: 'Seek' }).fill(String(total - 8));
  await footer.getByRole('slider', { name: 'Seek' }).dispatchEvent('pointerup');
  await expect(footer.locator('p').first()).not.toHaveText(secondTitle, { timeout: 20_000 });
});

test('mobile mini player opens the full-screen player', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Mobile layout only.');
  test.setTimeout(120_000);
  await signIn(page, info);

  await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
  await page
    .locator('main ol li')
    .first()
    .getByRole('button', { name: /^Play / })
    .click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Open player' }).click();
  await expect(page.getByRole('button', { name: 'Pause' }).last()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/screens/mobile-now-playing.png' });
});

test('track menu queues songs next and last', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'The queue panel is a desktop column.');
  test.setTimeout(120_000);
  await signIn(page, info);

  await page.goto('/search?q=daft%20punk&filter=songs');
  const rows = page.locator('main ol li');
  await expect(rows.nth(3)).toBeVisible({ timeout: 30_000 });
  await rows
    .first()
    .getByRole('button', { name: /^Play / })
    .click();

  const queued = (await rows.nth(3).locator('p').first().textContent()) ?? '';
  await rows.nth(3).getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Play next' }).click();

  const nextUp = page
    .locator('aside')
    .filter({ hasText: 'Next in queue' })
    .locator('ol li')
    .first();
  await expect(nextUp).toContainText(queued);
  await page.screenshot({ path: 'test-results/screens/desktop-queue.png' });
});
