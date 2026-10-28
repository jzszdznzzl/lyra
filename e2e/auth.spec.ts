import { expect, test } from '@playwright/test';

import { latestLink } from './outbox.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';

test('register, verify, add a passkey and sign back in with it', async ({
  page,
  context,
}, info) => {
  const id = `${info.project.name}${Date.now()}`.toLowerCase().replaceAll('-', '').slice(0, 20);
  const email = `${id}@example.com`;

  // A virtual authenticator stands in for the fingerprint sensor.
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.screenshot({ path: `test-results/screens/${info.project.name}-register.png` });

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Name', { exact: true }).fill('Ana');
  await page.getByLabel('Username', { exact: true }).fill(id);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await expect(page.getByText(/too easy|Use a longer passphrase/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();

  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

  await page.goto(await latestLink(email));
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Profile' }).first().click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();

  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByRole('button', { name: 'Rename' })).toBeVisible();
  await expect(page.getByText('No passkeys yet.')).toBeHidden();
  await page.screenshot({
    path: `test-results/screens/${info.project.name}-profile.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible();

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('nobody');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong email, username or password.');
});
