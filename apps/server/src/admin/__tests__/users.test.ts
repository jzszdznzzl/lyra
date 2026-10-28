import { describe, expect, test } from 'bun:test';

import { AdminUser } from '@lyra/shared';

import { createApp } from '../../app.ts';
import { schema } from '../../db/index.ts';
import {
  TEST_ORIGIN,
  TestClient,
  createTestContext,
  linkToken,
} from '../../testing/test-context.ts';
import type { App } from '../../app.ts';
import type { TestContext } from '../../testing/test-context.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';

async function signUp(ctx: TestContext, app: App, username: string) {
  const client = new TestClient(app);
  const before = ctx.mailer.sent.length;
  await client.request('POST', '/auth/register', {
    email: `${username}@example.com`,
    username,
    name: username,
    password: PASSWORD,
  });
  const verified = await client.request('POST', '/auth/verify-email', {
    token: linkToken(ctx.mailer.sent[before]?.text ?? ''),
  });

  return { client, id: String(verified.body.id) };
}

async function setup() {
  const ctx = createTestContext();
  ctx.env.ADMIN_EMAILS = ['boss@example.com', 'second@example.com'];
  const app = createApp(ctx);
  const boss = await signUp(ctx, app, 'boss');
  const second = await signUp(ctx, app, 'second');
  const ana = await signUp(ctx, app, 'ana');

  return { ctx, app, boss, second, ana };
}

describe('admin users', () => {
  test('the panel does not exist for anyone but admins', async () => {
    const { app, ana } = await setup();
    const anonymous = (path: string, method = 'GET') =>
      app.handle(
        new Request(`${TEST_ORIGIN}/api${path}`, { method, headers: { origin: TEST_ORIGIN } }),
      );
    const missing = await anonymous('/admin/nothing-here');

    for (const [method, path] of [
      ['GET', '/admin/users'],
      ['DELETE', `/admin/users/${ana.id}`],
      ['POST', `/admin/users/${'x'.repeat(200)}/suspend`],
    ] as const) {
      const asAnonymous = await anonymous(path, method);
      const asUser = await ana.client.request(method, path);

      expect(asAnonymous.status).toBe(404);
      expect(asUser.status).toBe(404);
      expect(asUser.body).toEqual({ error: 'not_found' });
    }

    expect(missing.status).toBe(404);
  });

  test('lists accounts without private data', async () => {
    const { boss } = await setup();
    const listed = await boss.client.request('GET', '/admin/users');

    expect(listed.status).toBe(200);
    const users = AdminUser.array().parse(listed.body);
    expect(users.map((user) => user.username).sort()).toEqual(['ana', 'boss', 'second']);
    expect(users.find((user) => user.username === 'boss')?.isAdmin).toBe(true);
    expect(JSON.stringify(listed.body)).not.toContain('@example.com');
  });

  test('a suspended account loses its sessions and cannot sign in until it is restored', async () => {
    const { boss, ana } = await setup();

    expect((await boss.client.request('POST', `/admin/users/${ana.id}/suspend`)).status).toBe(204);
    expect((await ana.client.request('GET', '/me')).status).toBe(401);

    const login = await ana.client.request('POST', '/auth/login', {
      identifier: 'ana',
      password: PASSWORD,
    });
    expect(login.status).toBe(403);
    expect(login.body.error).toBe('account_suspended');

    const users = AdminUser.array().parse((await boss.client.request('GET', '/admin/users')).body);
    expect(users.find((user) => user.id === ana.id)?.isSuspended).toBe(true);

    expect((await boss.client.request('POST', `/admin/users/${ana.id}/unsuspend`)).status).toBe(
      204,
    );
    const back = await ana.client.request('POST', '/auth/login', {
      identifier: 'ana',
      password: PASSWORD,
    });
    expect(back.status).toBe(200);
  });

  test('admins cannot act on themselves or on another admin', async () => {
    const { boss, second } = await setup();

    for (const id of [boss.id, second.id]) {
      const suspended = await boss.client.request('POST', `/admin/users/${id}/suspend`);
      expect(suspended.status).toBe(409);
      expect(suspended.body.error).toBe('protected_account');
      expect((await boss.client.request('DELETE', `/admin/users/${id}`)).status).toBe(409);
    }
  });

  test('deleting removes the account and its sessions', async () => {
    const { ctx, boss, ana } = await setup();

    expect((await boss.client.request('DELETE', `/admin/users/${ana.id}`)).status).toBe(204);
    expect((await ana.client.request('GET', '/me')).status).toBe(401);
    expect((await boss.client.request('DELETE', `/admin/users/${ana.id}`)).status).toBe(404);

    const sessions = await ctx.db.select().from(schema.sessions);
    expect(sessions.every((session) => session.userId !== ana.id)).toBe(true);
  });
});
