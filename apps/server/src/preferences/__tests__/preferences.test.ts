import { describe, expect, test } from 'bun:test';

import { SyncedPreferences } from '@lyra/shared';
import type { ListeningPreferences } from '@lyra/shared';

import { createApp } from '../../app.ts';
import { schema } from '../../db/index.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';
import type { App } from '../../app.ts';
import type { TestContext } from '../../testing/test-context.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';
const PREFERENCES: ListeningPreferences = {
  crossfadeSeconds: 6,
  fadeMs: 300,
  isMixEnabled: true,
  isEqEnabled: true,
  eqPreset: 'bass_boost',
  eqGains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  isNormalizationEnabled: true,
  isLimiterEnabled: true,
  isAutoplayEnabled: false,
  isLyricsSyncEnabled: true,
};

async function signUp(ctx: TestContext, app: App, username: string) {
  const client = new TestClient(app);
  await client.request('POST', '/auth/register', {
    email: `${username}@example.com`,
    username,
    name: username,
    password: PASSWORD,
  });
  await client.request('POST', '/auth/verify-email', {
    token: linkToken(ctx.mailer.sent.at(-1)?.text ?? ''),
  });

  return client;
}

describe('listening preferences', () => {
  test('start empty, then keep the last save with its time', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const client = await signUp(ctx, app, 'ana');

    const empty = await client.request('GET', '/me/preferences');
    expect(empty.status).toBe(200);
    expect(SyncedPreferences.parse(empty.body)).toEqual({ preferences: null, updatedAt: null });

    const saved = await client.request('PUT', '/me/preferences', PREFERENCES);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ preferences: PREFERENCES, updatedAt: ctx.now() });

    ctx.advance(1000);
    await client.request('PUT', '/me/preferences', { ...PREFERENCES, crossfadeSeconds: 0 });
    const read = SyncedPreferences.parse((await client.request('GET', '/me/preferences')).body);
    expect(read.preferences?.crossfadeSeconds).toBe(0);
    expect(read.updatedAt).toBe(ctx.now());
  });

  test('are per account and need a session', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const ana = await signUp(ctx, app, 'ana');
    const ben = await signUp(ctx, app, 'ben');

    await ana.request('PUT', '/me/preferences', PREFERENCES);

    expect((await ben.request('GET', '/me/preferences')).body.preferences).toBeNull();
    expect((await new TestClient(app).request('GET', '/me/preferences')).status).toBe(401);
  });

  test('reject values out of range', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const client = await signUp(ctx, app, 'ana');

    const tooLoud = { ...PREFERENCES, eqGains: [40, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    expect((await client.request('PUT', '/me/preferences', tooLoud)).status).toBe(422);
    const missingBand = { ...PREFERENCES, eqGains: [0, 0] };
    expect((await client.request('PUT', '/me/preferences', missingBand)).status).toBe(422);
  });

  test('a stored copy that no longer validates reads as none', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const client = await signUp(ctx, app, 'ana');
    await client.request('PUT', '/me/preferences', PREFERENCES);

    await ctx.db.update(schema.users).set({ listeningPreferences: { crossfadeSeconds: 'x' } });

    expect((await client.request('GET', '/me/preferences')).body).toEqual({
      preferences: null,
      updatedAt: null,
    });
  });
});
