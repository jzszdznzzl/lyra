import { expect, test } from '@playwright/test';

import { signIn } from './account.ts';

test.describe('connect resilience', () => {
  test.skip(({ isMobile }) => isMobile, 'Runs once; it opens its own second device.');

  test('a device that joins while music plays shows it right away', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(150_000);
    await signIn(page, info);
    await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
    await page
      .locator('main ol li')
      .first()
      .getByRole('button', { name: /^Play / })
      .click({ timeout: 30_000 });
    await expect(page.locator('footer').getByRole('button', { name: 'Pause' })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(6000);

    const phone = await browser.newPage({ storageState: await page.context().storageState() });
    await phone.goto('/');
    const phoneBar = phone.locator('footer');
    await expect(phoneBar).toContainText('Playing on', { timeout: 5000 });
    await expect(phoneBar).toContainText('Get Lucky');
    await expect(phoneBar.getByRole('button', { name: 'Pause' })).toBeVisible();
    await phone.close();
  });

  test('reloading the playing device resumes there and others keep following', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(150_000);
    await signIn(page, info);
    const phone = await browser.newPage({ storageState: await page.context().storageState() });
    await phone.goto('/');

    await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
    await page
      .locator('main ol li')
      .first()
      .getByRole('button', { name: /^Play / })
      .click({ timeout: 30_000 });
    const pcBar = page.locator('footer');
    const phoneBar = phone.locator('footer');
    await expect(pcBar.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });
    await expect(phoneBar).toContainText('Playing on', { timeout: 15_000 });
    await page.waitForTimeout(4000);

    await page.reload();

    // The phone keeps showing the PC as the player instead of grabbing playback itself.
    await expect(phoneBar).toContainText('Playing on', { timeout: 15_000 });
    // The reloaded PC picks the song back up (paused if the browser blocks autoplay).
    await expect(pcBar).toContainText('Get Lucky', { timeout: 15_000 });
    await expect(pcBar).not.toContainText('Playing on');
    const elapsed = pcBar.locator('span.w-10').first();
    await expect
      .poll(async () => (await elapsed.textContent()) ?? '0:00', { timeout: 15_000 })
      .not.toBe('0:00');
    await phone.close();
  });
});
