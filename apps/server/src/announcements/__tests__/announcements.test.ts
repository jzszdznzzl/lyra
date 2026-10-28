import { describe, expect, test } from 'bun:test';

import { Announcement } from '@lyra/shared';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';
import type { App } from '../../app.ts';
import type { TestContext } from '../../testing/test-context.ts';

const MINUTE_MS = 60 * 1000;

async function signUp(ctx: TestContext, app: App, username: string) {
  const client = new TestClient(app);
  const before = ctx.mailer.sent.length;
  await client.request('POST', '/auth/register', {
    email: `${username}@example.com`,
    username,
    name: username,
    password: 'violet-harbor-71-quietly-ember',
  });
  await client.request('POST', '/auth/verify-email', {
    token: linkToken(ctx.mailer.sent[before]?.text ?? ''),
  });

  return client;
}

describe('announcements', () => {
  test('everyone sees an announcement until it expires', async () => {
    const ctx = createTestContext();
    ctx.env.ADMIN_EMAILS = ['boss@example.com'];
    const app = createApp(ctx);
    const boss = await signUp(ctx, app, 'boss');
    const ana = await signUp(ctx, app, 'ana');

    const created = await boss.request('POST', '/admin/announcements', {
      message: 'Mantenimiento a las 22:00',
      level: 'warning',
      durationMinutes: 60,
    });
    expect(created.status).toBe(201);

    const live = Announcement.array().parse((await ana.request('GET', '/announcements')).body);
    expect(live.map((item) => item.message)).toEqual(['Mantenimiento a las 22:00']);
    expect(live[0]?.expiresAt).toBe(ctx.now() + 60 * MINUTE_MS);

    ctx.advance(61 * MINUTE_MS);
    expect((await ana.request('GET', '/announcements')).body).toEqual([]);
    // The panel still lists it, for reference.
    expect((await boss.request('GET', '/admin/announcements')).body).toHaveLength(1);
  });

  test('an admin can end one early, and only admins can publish', async () => {
    const ctx = createTestContext();
    ctx.env.ADMIN_EMAILS = ['boss@example.com'];
    const app = createApp(ctx);
    const boss = await signUp(ctx, app, 'boss');
    const ana = await signUp(ctx, app, 'ana');
    const input = { message: 'Hola', level: 'info', durationMinutes: 30 };

    expect((await ana.request('POST', '/admin/announcements', input)).status).toBe(404);

    const created = Announcement.parse(
      (await boss.request('POST', '/admin/announcements', input)).body,
    );
    expect((await boss.request('DELETE', `/admin/announcements/${created.id}`)).status).toBe(204);
    expect((await ana.request('GET', '/announcements')).body).toEqual([]);
    expect((await boss.request('DELETE', `/admin/announcements/${created.id}`)).status).toBe(404);
  });

  test('messages and durations are checked', async () => {
    const ctx = createTestContext();
    ctx.env.ADMIN_EMAILS = ['boss@example.com'];
    const boss = await signUp(ctx, createApp(ctx), 'boss');

    for (const body of [
      { message: '', level: 'info', durationMinutes: 30 },
      { message: 'x'.repeat(501), level: 'info', durationMinutes: 30 },
      { message: 'Hola', level: 'shout', durationMinutes: 30 },
      { message: 'Hola', level: 'info', durationMinutes: 60 * 24 * 365 },
    ]) {
      expect((await boss.request('POST', '/admin/announcements', body)).status).toBe(422);
    }
  });
});
