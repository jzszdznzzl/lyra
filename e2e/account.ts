import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { latestLink } from './outbox.ts';

export const PASSWORD = 'violet-harbor-71-quietly-ember';

/** Creates and verifies a fresh account, leaving the page signed in on the home screen. */
export async function signUp(page: Page, info: TestInfo) {
  const id = `${info.project.name}${Date.now()}`.toLowerCase().replaceAll('-', '').slice(0, 20);
  const email = `${id}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Name', { exact: true }).fill('Ana');
  await page.getByLabel('Username', { exact: true }).fill(id);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  await page.goto(await latestLink(email));
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible();

  return { id, email };
}

/**
 * Signs in with one shared account per project, created on first use. Registering per test
 * would trip the server's sign-up rate limit, which is working as intended.
 */
export async function signIn(page: Page, info: TestInfo) {
  const statePath = join(process.env['E2E_DATA_DIR'] ?? '', `auth-${info.project.name}.json`);

  if (existsSync(statePath)) {
    const state: unknown = JSON.parse(readFileSync(statePath, 'utf8'));
    const cookies =
      typeof state === 'object' &&
      state !== null &&
      'cookies' in state &&
      Array.isArray(state.cookies)
        ? state.cookies
        : [];
    await page.context().addCookies(cookies);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
    ).toBeVisible();

    return;
  }

  await signUp(page, info);
  await page.context().storageState({ path: statePath });
}
