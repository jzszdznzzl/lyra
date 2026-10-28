import { describe, expect, test } from 'bun:test';

import { AdminSettingsView } from '@lyra/shared';

import { createApp } from '../../app.ts';
import { schema } from '../../db/index.ts';
import { saveGoogleAccount } from '../../google/accounts.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';
import { SettingsStore } from '../settings.ts';
import type { App } from '../../app.ts';
import type { TestContext } from '../../testing/test-context.ts';

async function signUp(ctx: TestContext, app: App, username: string) {
  const client = new TestClient(app);
  const before = ctx.mailer.sent.length;
  await client.request('POST', '/auth/register', {
    email: `${username}@example.com`,
    username,
    name: username,
    password: 'violet-harbor-71-quietly-ember',
  });
  const verified = await client.request('POST', '/auth/verify-email', {
    token: linkToken(ctx.mailer.sent[before]?.text ?? ''),
  });

  return { client, id: String(verified.body.id) };
}

describe('SettingsStore', () => {
  test('panel values override the env file and survive a restart', () => {
    const ctx = createTestContext();
    expect(ctx.settings.current.isRegistrationEnabled).toBe(true);
    expect(ctx.settings.current.mailFrom).toBe('Lyra <noreply@lyra.test>');

    ctx.settings.update({ isRegistrationEnabled: false, mailFrom: 'Música <hola@lyra.test>' });
    const restarted = new SettingsStore(ctx.db, ctx.env, ctx.secretKey, ctx.now);

    expect(restarted.current.isRegistrationEnabled).toBe(false);
    expect(restarted.current.mailFrom).toBe('Música <hola@lyra.test>');
  });

  test('the SMTP password is stored encrypted and never shown', async () => {
    const ctx = createTestContext();
    ctx.settings.update({ smtpPassword: 'hunter2-but-longer' });

    const rows = await ctx.db.select().from(schema.settings);
    expect(JSON.stringify(rows)).not.toContain('hunter2');
    expect(ctx.settings.current.smtp.pass).toBe('hunter2-but-longer');
    expect(ctx.settings.forAdmin().hasSmtpPassword).toBe(true);
    expect(JSON.stringify(ctx.settings.forAdmin())).not.toContain('hunter2');
  });

  test('a corrupted stored value falls back to the env file', async () => {
    const ctx = createTestContext();
    await ctx.db
      .insert(schema.settings)
      .values({ key: 'isRegistrationEnabled', value: 'yes please', updatedAt: 0 });

    expect(
      new SettingsStore(ctx.db, ctx.env, ctx.secretKey, ctx.now).current.isRegistrationEnabled,
    ).toBe(true);
  });
});

describe('admin settings', () => {
  test('admins read and change them; a change applies at once', async () => {
    const ctx = createTestContext();
    ctx.env.ADMIN_EMAILS = ['boss@example.com'];
    const app = createApp(ctx);
    const boss = await signUp(ctx, app, 'boss');
    const ana = await signUp(ctx, app, 'ana');

    expect((await ana.client.request('GET', '/admin/settings')).status).toBe(404);

    const changed = await boss.client.request('PATCH', '/admin/settings', {
      isRegistrationEnabled: false,
    });
    expect(AdminSettingsView.parse(changed.body).isRegistrationEnabled).toBe(false);
    expect((await new TestClient(app).request('GET', '/config')).body).toEqual({
      isRegistrationEnabled: false,
    });

    expect(
      (await boss.client.request('PATCH', '/admin/settings', { smtpPort: 70_000 })).status,
    ).toBe(422);
  });

  test('says whether the fallback account can play', async () => {
    const ctx = createTestContext();
    ctx.env.ADMIN_EMAILS = ['boss@example.com'];
    const app = createApp(ctx);
    const boss = await signUp(ctx, app, 'boss');
    const helper = await signUp(ctx, app, 'helper');
    const status = async (streamFallbackUsername: string | null) =>
      AdminSettingsView.parse(
        (await boss.client.request('PATCH', '/admin/settings', { streamFallbackUsername })).body,
      ).fallbackStatus;

    expect(await status(null)).toBe('off');
    expect(await status('')).toBe('off');
    expect(await status('nobody')).toBe('unknown_user');
    expect(await status('helper')).toBe('not_linked');

    await saveGoogleAccount(ctx, helper.id, 'SAPISID=x', 'cookies', {
      name: 'Helper',
      email: null,
      photo: null,
    });
    expect(await status('helper')).toBe('ready');
  });

  test('the test mail goes to the admin', async () => {
    const ctx = createTestContext();
    ctx.env.ADMIN_EMAILS = ['boss@example.com'];
    const boss = await signUp(ctx, createApp(ctx), 'boss');

    expect((await boss.client.request('POST', '/admin/settings/test-mail')).status).toBe(204);
    expect(ctx.mailer.sent.at(-1)?.to).toBe('boss@example.com');
  });
});
