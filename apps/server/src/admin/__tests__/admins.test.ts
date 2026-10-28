import { describe, expect, test } from 'bun:test';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';

describe('admins', () => {
  test('an email in ADMIN_EMAILS makes an admin only once it is verified', async () => {
    const ctx = createTestContext();
    ctx.env.ADMIN_EMAILS = ['boss@example.com'];
    const app = createApp(ctx);
    const boss = new TestClient(app);
    const other = new TestClient(app);

    await boss.request('POST', '/auth/register', {
      email: 'Boss@Example.com',
      username: 'boss',
      name: 'Boss',
      password: PASSWORD,
    });
    await other.request('POST', '/auth/register', {
      email: 'ana@example.com',
      username: 'ana',
      name: 'Ana',
      password: PASSWORD,
    });

    // Not verified yet: signing in is refused, so the role cannot be used either.
    const early = await boss.request('POST', '/auth/login', {
      identifier: 'boss',
      password: PASSWORD,
    });
    expect(early.body?.isAdmin).toBeUndefined();

    const verified = await boss.request('POST', '/auth/verify-email', {
      token: linkToken(ctx.mailer.sent[0]?.text ?? ''),
    });
    expect(verified.body.isAdmin).toBe(true);
    expect((await boss.request('GET', '/me')).body.isAdmin).toBe(true);

    const ana = await other.request('POST', '/auth/verify-email', {
      token: linkToken(ctx.mailer.sent[1]?.text ?? ''),
    });
    // Regular accounts do not even see the field.
    expect('isAdmin' in ana.body).toBe(false);
  });
});
