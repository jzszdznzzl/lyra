import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

test.describe('mobile navigation', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile layout only.');

  test('going to the artist from the full-screen player shows the artist', async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await signIn(page, info);
    await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
    await page
      .locator('main ol li')
      .first()
      .getByRole('button', { name: /^Play / })
      .click({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Open player' }).click();

    await page.getByRole('button', { name: 'More options' }).last().click();
    await page.getByRole('menuitem', { name: 'Go to artist' }).click();

    await expect(page.getByRole('button', { name: 'Close' })).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Daft Punk', {
      timeout: 30_000,
    });
  });

  test('back closes the player first, then returns to the previous page', async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await signIn(page, info);
    await page.goto('/search?q=daft%20punk&filter=albums');
    const album = page.locator('a[href^="/album/"]').first();
    await album.click({ timeout: 30_000 });
    await expect(page.locator('main ol li').first()).toBeVisible({ timeout: 30_000 });
    await page
      .locator('main ol li')
      .first()
      .getByRole('button', { name: /^Play / })
      .click();
    await page.getByRole('button', { name: 'Open player' }).click();
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('button', { name: 'Close' })).toBeHidden();
    await expect(page).toHaveURL(/\/album\//);

    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/\/search\?/);
  });
});
