import { expect, test } from '@playwright/test';

import { PASSWORD, signUp } from './account.ts';

test('deleting the account signs out everywhere and frees nothing to log into', async ({
  page,
}, info) => {
  // Its own account: the shared one is used by every other test.
  test.skip(info.project.name === 'mobile', 'Runs once; sign-ups are rate limited.');
  const { email } = await signUp(page, info);
  await page.evaluate(() => localStorage.setItem('lyra.recent-searches', '["queen"]'));

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Delete account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
  await dialog.getByLabel('Password').fill('not-my-password');
  await dialog.getByRole('button', { name: 'Delete forever' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Wrong email, username or password.');

  await dialog.getByLabel('Password').fill(PASSWORD);
  await dialog.getByRole('button', { name: 'Delete forever' }).click();
  await expect(page).toHaveURL(/\/register$/);
  expect(await page.evaluate(() => localStorage.getItem('lyra.recent-searches'))).toBeNull();

  await page.goto('/login');
  await page.getByLabel('Email or username').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong email, username or password.');
});
