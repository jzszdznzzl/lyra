import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { PASSWORD, signIn } from './account.ts';

test.describe('sharing and link previews', () => {
  test.skip(({ isMobile }) => isMobile, 'Runs once.');

  test('sharing a song copies a lyra link that opens the song', async ({ page, context }, info) => {
    test.setTimeout(120_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signIn(page, info);
    await page.goto('/search?q=daft%20punk%20get%20lucky&filter=songs');
    const row = page.locator('main ol li').first();
    await row.getByRole('button', { name: 'More options' }).click({ timeout: 30_000 });
    await page.getByRole('menuitem', { name: 'Share' }).click();
    await expect(page.getByText('Link copied')).toBeVisible();

    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(new RegExp(`^${new URL(page.url()).origin}/track/[\\w-]{11}$`));

    await page.goto(link);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Get Lucky', {
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: 'Similar songs' })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('shared album links show a card with the cover, even signed out', async ({
    request,
    page,
  }, info) => {
    test.setTimeout(120_000);
    await signIn(page, info);
    await page.goto('/search?q=random%20access%20memories&filter=albums');
    const href =
      (await page
        .locator('a[href^="/album/"]')
        .first()
        .getAttribute('href', { timeout: 30_000 })) ?? '';

    // A link preview bot has no session.
    const html = await (await request.get(href, { headers: { cookie: '' } })).text();
    expect(html).toContain('<meta property="og:title" content="Random Access Memories" />');
    expect(html).toMatch(
      /<meta property="og:image" content="http[^"]+\/api\/images\/[\w-]{22}" \/>/,
    );
    expect(html).toContain('<meta name="robots" content="noindex" />');

    const image = /\/api\/images\/[\w-]{22}/.exec(html)?.[0] ?? '';
    const cover = await request.get(image, { headers: { cookie: '' } });
    expect(cover.status()).toBe(200);
    expect(cover.headers()['content-type']).toMatch(/^image\//);
    expect(cover.headers()['content-security-policy']).toBeUndefined();
  });

  test('a link opened while signed out comes back after signing in', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120_000);
    await signIn(page, info);
    const username = await page.evaluate(() => {
      const profile: unknown = JSON.parse(localStorage.getItem('lyra.profile') ?? '{}');

      return typeof profile === 'object' && profile !== null && 'username' in profile
        ? String(profile.username)
        : '';
    });

    const stranger = await browser.newPage();
    await stranger.goto('/track/4D7u5KF7SP8');
    await expect(stranger).toHaveURL(/\/login\?redirect=/);

    await stranger.getByLabel('Email or username').fill(username);
    await stranger.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await stranger.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(stranger).toHaveURL(/\/track\/4D7u5KF7SP8$/);
    await stranger.close();
  });
});

test('the public build ships no source maps', () => {
  const root = join(process.env['E2E_DATA_DIR'] ?? '', 'web');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);

      if (statSync(path).isDirectory()) {
        walk(path);
      } else {
        files.push(path);
      }
    }
  };
  walk(root);

  expect(files.filter((file) => file.endsWith('.map'))).toEqual([]);
  expect(
    files.filter(
      (file) =>
        /\.(js|mjs|css)$/.test(file) && readFileSync(file, 'utf8').includes('sourceMappingURL'),
    ),
  ).toEqual([]);
});
