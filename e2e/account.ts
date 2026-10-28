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
