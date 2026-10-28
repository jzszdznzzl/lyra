import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

test('explore, 404 and the top search result', async ({ page }, info) => {
  test.setTimeout(120_000);
  await signIn(page, info);

  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore', level: 1 })).toBeVisible();
  await expect(page.locator('main section h2').first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveTitle('Explore · Lyra');

  await page.goto('/this/does/not/exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();

  await page.goto('/search?q=daft%20punk&filter=all');
  await expect(
    page.locator('a[href^="/artist/"]').filter({ hasText: 'Daft Punk' }).first(),
  ).toBeVisible({ timeout: 30_000 });
  // Songs under the top result now name their artist.
  await expect(page.locator('main ol li').first()).toContainText('Daft Punk');
});

test('keyboard: space plays and pauses, arrows seek', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Keyboard shortcuts are for desktop.');
  test.setTimeout(120_000);
  await signIn(page, info);
  await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
  await page
    .locator('main ol li')
    .first()
    .getByRole('button', { name: /^Play / })
    .click({ timeout: 30_000 });
  const bar = page.locator('footer');
  await expect(bar.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });

  await page
    .locator('main h1, main')
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Space');
  await expect(bar.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(bar.getByRole('button', { name: 'Pause' })).toBeVisible();

  const elapsed = bar.locator('span.w-10').first();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(async () => {
      const [minutes = '0', seconds = '0'] = ((await elapsed.textContent()) ?? '0:00').split(':');

      return Number(minutes) * 60 + Number(seconds);
    })
    .toBeGreaterThanOrEqual(30);
});
