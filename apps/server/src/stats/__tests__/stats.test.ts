import { describe, expect, test } from 'bun:test';

import { AdminStats, StatEvent } from '@lyra/shared';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';
import { countEvent } from '../recorder.ts';
import { adminStats } from '../stats.ts';
import type { App } from '../../app.ts';
import type { TestContext } from '../../testing/test-context.ts';

const HOUR_MS = 60 * 60 * 1000;

function track(id: string, title: string, artists: string[]) {
  return {
    kind: 'song',
    id,
    title,
    artists: artists.map((name) => ({ id: null, name })),
    album: null,
    durationSeconds: 180,
    thumbnail: null,
    isExplicit: false,
  };
}

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

describe('statistics', () => {
  test('plays, listeners and top songs are counted as totals', async () => {
    const ctx = createTestContext();
    ctx.env.ADMIN_EMAILS = ['boss@example.com'];
    const app = createApp(ctx);
    const boss = await signUp(ctx, app, 'boss');
    const ana = await signUp(ctx, app, 'ana');
    const luis = await signUp(ctx, app, 'luis');
    const lucky = track('aaaaaaaaaaa', 'Get Lucky', ['Daft Punk', 'Pharrell Williams']);
    const numb = track('bbbbbbbbbbb', 'Numb', ['Linkin Park']);

    for (const [client, played] of [
      [ana.client, lucky],
      [ana.client, lucky],
      [luis.client, lucky],
      [luis.client, numb],
    ] as const) {
      const listened = await client.request('POST', `/music/history/${played.id}`, {
        track: played,
      });
      expect(listened.status).toBe(204);
    }

    // Older clients send no track: the play still counts.
    await luis.client.request('POST', '/music/history/ccccccccccc');

    const response = await boss.client.request('GET', '/admin/stats?days=7&offset=-180');
    expect(response.status).toBe(200);
    const stats = AdminStats.parse(response.body);

    expect(stats.period.plays).toBe(5);
    expect(stats.period.listeners).toBe(2);
    expect(stats.period.signups).toBe(3);
    expect(stats.period.minutesPlayed).toBe(12);
    expect(stats.totals.users).toBe(3);
    expect(stats.totals.admins).toBe(1);
    expect(stats.topTracks[0]).toEqual({
      videoId: 'aaaaaaaaaaa',
      title: 'Get Lucky',
      artists: 'Daft Punk, Pharrell Williams',
      plays: 3,
    });
    expect(stats.topArtists[0]).toEqual({ name: 'Daft Punk', plays: 3 });
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily.at(-1)?.plays).toBe(5);
    expect(stats.daily.at(-1)?.activeUsers).toBe(3);
    expect(stats.playsByHour.reduce((sum, value) => sum + value, 0)).toBe(5);

    // Totals only: no account ids or usernames anywhere in the answer.
    const text = JSON.stringify(response.body);
    for (const id of [ana.id, luis.id, 'ana', 'luis']) {
      expect(text).not.toContain(`"${id}"`);
    }
  });

  test('days start at the admin midnight', async () => {
    const ctx = createTestContext();
    // The test clock starts at 2026-10-27 00:00 UTC, which is 21:00 of the 26th in UTC-3.
    countEvent(ctx, StatEvent.StreamOwn);
    ctx.advance(4 * HOUR_MS);
    countEvent(ctx, StatEvent.StreamOwn);
    countEvent(ctx, StatEvent.StreamFallback);

    const utc = await adminStats(ctx, { days: 7, offset: 0 }, 0);
    const chile = await adminStats(ctx, { days: 7, offset: -180 }, 0);

    expect(utc.daily.at(-1)).toMatchObject({ day: '2026-10-27', streamOwn: 2, streamFallback: 1 });
    expect(chile.daily.at(-2)).toMatchObject({ day: '2026-10-26', streamOwn: 1 });
    expect(chile.daily.at(-1)).toMatchObject({
      day: '2026-10-27',
      streamOwn: 1,
      streamFallback: 1,
    });
  });

  test('only admins see them, and the range is checked', async () => {
    const ctx = createTestContext();
    ctx.env.ADMIN_EMAILS = ['boss@example.com'];
    const app = createApp(ctx);
    const boss = await signUp(ctx, app, 'boss');
    const ana = await signUp(ctx, app, 'ana');

    expect((await ana.client.request('GET', '/admin/stats?days=7&offset=0')).status).toBe(404);
    expect((await boss.client.request('GET', '/admin/stats?days=8&offset=0')).status).toBe(422);
  });
});
