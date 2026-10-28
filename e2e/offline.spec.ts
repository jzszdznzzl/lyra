import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

function seconds(text: string | null) {
  const [minutes = '0', rest = '0'] = (text ?? '0:00').split(':');

  return Number(minutes) * 60 + Number(rest);
}

test('a downloaded song plays with the network off', async ({ page, context }, info) => {
  test.skip(info.project.name === 'mobile', 'Runs once.');
  test.setTimeout(180_000);
  await signIn(page, info);

  // The service worker must control the page before going offline.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
  const row = page.locator('main ol li').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const title = (await row.locator('p').first().textContent()) ?? '';
  await row.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Download' }).click();
  await expect(row.getByLabel('Downloaded')).toBeVisible({ timeout: 90_000 });

  await page.goto('/downloads');
  await expect(page.locator('main ol li')).toHaveCount(1);
  await expect(page.locator('main ol li').first()).toContainText(title);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('You’re offline. Your downloads still play.')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('main ol li').first()).toContainText(title);

  await page
    .locator('main ol li')
    .first()
    .getByRole('button', { name: /^Play / })
    .click();
  const elapsed = page.locator('footer span.w-10').first();
  await expect
    .poll(async () => seconds(await elapsed.textContent()), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: 'test-results/screens/desktop-offline.png' });

  // Seeking inside the cached file works too (range requests served by the worker).
  await page.locator('footer').getByRole('slider', { name: 'Seek' }).fill('120');
  await page.locator('footer').getByRole('slider', { name: 'Seek' }).dispatchEvent('pointerup');
  await expect
    .poll(async () => seconds(await elapsed.textContent()), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(120);

  await context.setOffline(false);
});

test('the app can be installed', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Runs once.');
  await signIn(page, info);
  const manifest: unknown = await page.evaluate(async () =>
    (await fetch('/manifest.webmanifest')).json(),
  );

  expect(manifest).toMatchObject({ name: 'Lyra', display: 'standalone', start_url: '/' });
  expect(await page.locator('link[rel="manifest"]').count()).toBe(1);
});
