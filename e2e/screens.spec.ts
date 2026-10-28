import { test } from '@playwright/test';

import { signIn } from './account.ts';

// Visual audit, not a check: LYRA_SCREENS=1 pnpm test:e2e e2e/screens.spec.ts
test.skip(process.env['LYRA_SCREENS'] !== '1', 'Run on demand to capture every screen.');

for (const [theme, language] of [
  ['light', 'en'],
  ['dark', 'es'],
  ['light', 'es'],
] as const) {
  test(`screens ${theme} ${language}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    await signIn(page, info);
    await page.evaluate(
      ({ selectedTheme, selectedLanguage }) => {
        localStorage.setItem('lyra.theme', selectedTheme);
        localStorage.setItem('lyra.language', selectedLanguage);
      },
      { selectedTheme: theme, selectedLanguage: language },
    );
    await page.goto('/profile');
    await page.locator('button', { hasText: language === 'es' ? 'Español' : 'English' }).click();
    const shot = async (name: string) => {
      await page.waitForTimeout(2500);
      await page.screenshot({
        path: `test-results/audit/${info.project.name}-${theme}-${language}-${name}.png`,
      });
    };

    await shot('profile');
    await page.goto('/');
    await shot('home');
    await page.goto('/search?q=daft%20punk&filter=all');
    await shot('search');
    await page
      .locator('main ol li')
      .first()
      .getByRole('button', { name: /^(Play|Reproducir) / })
      .click();
    await page.goto('/search?q=random%20access%20memories&filter=albums');
    await page.locator('a[href^="/album/"]').first().click();
    await shot('album');
    await page.goto('/downloads');
    await shot('downloads');
    await page.goto('/explore');
    await shot('explore');
    await page.goto('/nope');
    await shot('not-found');
  });
}
