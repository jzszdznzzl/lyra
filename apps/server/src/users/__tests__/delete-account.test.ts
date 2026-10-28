import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

import { createApp } from '../../app.ts';
import { schema } from '../../db/index.ts';
import { saveGoogleAccount } from '../../google/accounts.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';
import { avatarPath } from '../avatar.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';

describe('delete account', () => {
  test('needs the password, then removes the account and everything tied to it', async () => {
    const ctx = createTestContext();
    const client = new TestClient(createApp(ctx));
    await client.request('POST', '/auth/register', {
      email: 'ana@example.com',
      username: 'ana',
      name: 'Ana',
      password: PASSWORD,
    });
    const verified = await client.request('POST', '/auth/verify-email', {
      token: linkToken(ctx.mailer.sent[0]?.text ?? ''),
    });
    const userId: string = verified.body.id;

    const png = await new Response(
      Bun.file(new URL('../../auth/__tests__/fixtures/avatar.png', import.meta.url).pathname),
    ).arrayBuffer();
    const form = new FormData();
    form.set('file', new File([png], 'avatar.png', { type: 'image/png' }));
    await client.request('PUT', '/me/avatar', form);
    await saveGoogleAccount(ctx, userId, 'SAPISID=x', 'cookies', {
      name: 'Ana',
      email: null,
      photo: null,
    });
    expect(existsSync(avatarPath(ctx.dataDir, userId))).toBe(true);

    expect((await client.request('DELETE', '/me', { password: 'wrong-password' })).status).toBe(
      401,
    );
    expect((await client.request('GET', '/me')).status).toBe(200);

    expect((await client.request('DELETE', '/me', { password: PASSWORD })).status).toBe(204);
    expect(client.cookie).toBe('');

    expect(await ctx.db.select().from(schema.users)).toHaveLength(0);
    expect(await ctx.db.select().from(schema.sessions)).toHaveLength(0);
    expect(await ctx.db.select().from(schema.googleAccounts)).toHaveLength(0);
    expect(existsSync(avatarPath(ctx.dataDir, userId))).toBe(false);

    const login = await client.request('POST', '/auth/login', {
      identifier: 'ana',
      password: PASSWORD,
    });
    expect(login.status).toBe(401);
  });
});
