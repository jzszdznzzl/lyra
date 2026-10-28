import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

test('recent searches come back, can be reused and removed', async ({ page }, info) => {
  test.setTimeout(120_000);
  await signIn(page, info);
  await page.evaluate(() => localStorage.removeItem('lyra.recent-searches'));

  await page.goto('/search?q=queen&filter=all');
  await expect(page.locator('main ol li').first()).toBeVisible({ timeout: 30_000 });
  await page.goto('/search?q=daft%20punk&filter=all');
  await expect(page.locator('main ol li').first()).toBeVisible({ timeout: 30_000 });

  await page.goto('/search');
  const recent = page.locator('section').filter({ hasText: 'Recent searches' });
  await expect(recent.getByRole('button', { name: 'daft punk', exact: true })).toBeVisible();
  await expect(recent.locator('li')).toHaveCount(2);

  await recent.getByRole('button', { name: 'Remove “queen” from history' }).click();
  await expect(recent.locator('li')).toHaveCount(1);

  await recent.getByRole('button', { name: 'daft punk', exact: true }).click();
  await expect(page).toHaveURL(/q=daft\+punk|q=daft%20punk/);
});

test('a partly downloaded album offers only the remaining songs', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Runs once.');
  test.setTimeout(150_000);
  await signIn(page, info);
  await page.goto('/search?q=random%20access%20memories&filter=albums');
  await page.locator('a[href^="/album/"]').first().click({ timeout: 30_000 });
  const rows = page.locator('main ol li');
  await expect(rows.nth(3)).toBeVisible({ timeout: 30_000 });
  const total = await rows.count();

  await rows.first().getByRole('button', { name: 'More options' }).click();
  const download = page.getByRole('menuitem', { name: 'Download' });

  if (await download.isVisible()) {
    await download.click();
    await expect(rows.first().getByLabel('Downloaded')).toBeVisible({ timeout: 90_000 });
  } else {
    await page.keyboard.press('Escape');
  }

  await expect(page.getByRole('button', { name: `Download ${total - 1} remaining` })).toBeVisible();
});
