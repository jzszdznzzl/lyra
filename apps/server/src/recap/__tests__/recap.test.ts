import { describe, expect, test } from 'bun:test';

import { Recap } from '@lyra/shared';

import { createApp } from '../../app.ts';
import { schema } from '../../db/index.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';
import { buildRecap, yearStart } from '../recap.ts';
import type { PlayRow } from '../recap.ts';

const HOUR_MS = 60 * 60 * 1000;
// Buenos Aires: UTC-3.
const OFFSET = -180;

function play(
  videoId: string,
  artists: string[],
  playedAt: number,
  title: string | null = videoId,
) {
  return { videoId, title, artists, durationSeconds: 180, playedAt } satisfies PlayRow;
}

describe('buildRecap', () => {
  const start = yearStart(2026, OFFSET);
  const rows = [
    play('a', ['Ana'], start + 1 * HOUR_MS),
    play('b', ['Bea', 'Ana'], start + 2 * HOUR_MS),
    play('a', ['Ana'], start + 40 * 24 * HOUR_MS),
    play('c', ['Cris'], start + 41 * 24 * HOUR_MS, null),
  ];
  const recap = buildRecap(rows, 2026, OFFSET);

  test('adds up plays, minutes, songs and artists', () => {
    expect(recap.plays).toBe(4);
    expect(recap.minutes).toBe(12);
    expect(recap.songs).toBe(3);
    expect(recap.artists).toBe(3);
  });

  test('ranks artists and songs by plays', () => {
    expect(recap.topArtists).toEqual([
      { name: 'Ana', plays: 3 },
      { name: 'Bea', plays: 1 },
      { name: 'Cris', plays: 1 },
    ]);
    // A play without a title still counts, but cannot be shown as a song.
    expect(recap.topTracks.map((item) => [item.track.id, item.plays])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });

  test('buckets months and hours in local time', () => {
    expect(recap.months[0]).toBe(2);
    expect(recap.months[1]).toBe(2);
    expect(recap.hours[1]).toBe(1);
    expect(recap.hours[2]).toBe(1);
    expect(recap.firstTrack?.id).toBe('a');
  });
});

describe('recap route', () => {
  test('shows each person only their own plays', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const client = new TestClient(app);
    await client.request('POST', '/auth/register', {
      email: 'ana@example.com',
      username: 'ana',
      name: 'Ana',
      password: 'violet-harbor-71-quietly-ember',
    });
    const verified = await client.request('POST', '/auth/verify-email', {
      token: linkToken(ctx.mailer.sent.at(-1)?.text ?? ''),
    });
    const userId = String(verified.body.id);
    const playedAt = ctx.now();
    await ctx.db.insert(schema.plays).values([
      {
        userId,
        videoId: 'dQw4w9WgXcQ',
        title: 'Mine',
        artists: ['Ana'],
        durationSeconds: 200,
        playedAt,
      },
      {
        userId: null,
        videoId: 'other',
        title: 'Not mine',
        artists: ['X'],
        durationSeconds: 200,
        playedAt,
      },
    ]);
    const year = new Date(playedAt).getUTCFullYear();

    const response = await client.request('GET', `/me/recap?year=${year}&offset=0`);
    const recap = Recap.parse(response.body);

    expect(recap.plays).toBe(1);
    expect(recap.years).toEqual([year]);
    expect(recap.countingSince).toBe(playedAt);
    // The cover goes through the image proxy.
    expect(recap.topTracks[0]?.track.thumbnail).toStartWith('/api/images/');
    expect((await client.request('GET', '/me/recap?year=abc&offset=0')).status).toBe(422);
  });
});
