import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

test('a new version takes over open pages without closing them', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Runs once.');
  await signIn(page, info);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await page.evaluate(() => {
    sessionStorage.removeItem('sw-changed');
    navigator.serviceWorker.addEventListener('controllerchange', () =>
      sessionStorage.setItem('sw-changed', '1'),
    );
  });

  // A deploy: the worker file changes on the server.
  appendFileSync(
    join(process.env['E2E_DATA_DIR'] ?? '', 'web', 'sw.js'),
    `\n// deploy ${Date.now()}\n`,
  );
  // The update reloads the page, which may cut this call short.
  await page
    .evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    })
    .catch(() => undefined);

  // Before the fix the new worker stayed "waiting" until every tab was closed.
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('sw-changed')).catch(() => null), {
      timeout: 20_000,
    })
    .toBe('1');
});

test('an update waits while music plays and applies at the next pause', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Runs once.');
  test.setTimeout(120_000);
  await signIn(page, info);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
  await page
    .locator('main ol li')
    .first()
    .getByRole('button', { name: /^Play / })
    .click({ timeout: 30_000 });
  const bar = page.locator('footer');
  await expect(bar.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });

  await page.evaluate(() => {
    sessionStorage.removeItem('sw-changed');
    navigator.serviceWorker.addEventListener('controllerchange', () =>
      sessionStorage.setItem('sw-changed', '1'),
    );
  });
  appendFileSync(
    join(process.env['E2E_DATA_DIR'] ?? '', 'web', 'sw.js'),
    `\n// deploy ${Date.now()}\n`,
  );
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });

  // Still playing, still the old version.
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => sessionStorage.getItem('sw-changed'))).toBeNull();
  await expect(bar.getByRole('button', { name: 'Pause' })).toBeVisible();

  await bar.getByRole('button', { name: 'Pause' }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('sw-changed')).catch(() => null), {
      timeout: 20_000,
    })
    .toBe('1');
});
