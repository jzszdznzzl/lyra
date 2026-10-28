import { describe, expect, test } from 'bun:test';

import type { NowPlaying, PlaybackState, Track } from '@lyra/shared';

import { ConnectHub } from '../../connect/hub.ts';
import { schema } from '../../db/index.ts';
import { createTestContext } from '../../testing/test-context.ts';
import { NowPlayingService } from '../now-playing.ts';

const USER_ID = 'user-1';
const DEVICE = { id: 'device-pc-1', name: 'Chrome on Linux', kind: 'desktop' as const };

function track(id: string): Track {
  return {
    kind: 'song',
    id,
    title: `Song ${id}`,
    artists: [{ id: null, name: 'Artist' }],
    album: null,
    durationSeconds: 200,
    thumbnail: null,
    isExplicit: false,
  };
}

function state(patch: Partial<PlaybackState> = {}): PlaybackState {
  return {
    queue: [track('aaaaaaaaaaa'), track('bbbbbbbbbbb')],
    index: 0,
    positionMs: 0,
    updatedAt: 0,
    isPlaying: true,
    volume: 1,
    repeat: 'off',
    isShuffled: false,
    ...patch,
  };
}

async function setup() {
  const ctx = createTestContext();
  await ctx.db.insert(schema.users).values({
    id: USER_ID,
    email: 'ana@example.com',
    username: 'ana',
    name: 'Ana',
    passwordHash: 'x',
    language: 'es',
    createdAt: ctx.now(),
  });
  const hub = new ConnectHub(ctx.now, 0);
  const service = new NowPlayingService(ctx, hub);
  const events: NowPlaying[] = [];
  service.subscribe(USER_ID, (nowPlaying) => events.push(nowPlaying));
  hub.join(USER_ID, { id: 'socket-1', send: () => {}, close: () => {} }, DEVICE);
  const report = (patch: Partial<PlaybackState>) =>
    hub.handle(USER_ID, 'socket-1', { type: 'state', state: state(patch) });
  // Lets the fire-and-forget database write finish.
  const settle = () => Bun.sleep(5);

  return { ctx, hub, service, events, report, settle };
}

describe('NowPlayingService', () => {
  test('reports the live song with its device and an extrapolated position', async () => {
    const { ctx, service, report } = await setup();
    report({ positionMs: 30_000 });
    ctx.advance(5000);

    const current = await service.current(USER_ID);
    expect(current?.isPlaying).toBe(true);
    expect(current?.track.id).toBe('aaaaaaaaaaa');
    expect(current?.progressMs).toBe(35_000);
    expect(current?.device).toEqual({ name: 'Chrome on Linux', kind: 'desktop' });
  });

  test('a paused song keeps the time it stopped', async () => {
    const { ctx, service, report } = await setup();
    report({ positionMs: 0 });
    ctx.advance(12_000);
    const pausedAt = ctx.now();
    report({ isPlaying: false, positionMs: 12_000 });
    ctx.advance(60 * 60 * 1000);

    const current = await service.current(USER_ID);
    expect(current?.isPlaying).toBe(false);
    expect(current?.updatedAt).toBe(pausedAt);
  });

  test('the last song survives a restart', async () => {
    const { ctx, report, settle } = await setup();
    report({ index: 1 });
    await settle();

    const restarted = new NowPlayingService(ctx, new ConnectHub(ctx.now, 0));
    const current = await restarted.current(USER_ID);
    expect(current?.isPlaying).toBe(false);
    expect(current?.track.id).toBe('bbbbbbbbbbb');
    expect(current?.device).toBeNull();
  });

  test('listeners hear changes and seeks, not every position report', async () => {
    const { ctx, events, report } = await setup();
    report({ positionMs: 0 });
    ctx.advance(10_000);
    // Where it should be after 10 s of playing: nothing new to tell.
    report({ positionMs: 10_000 });
    ctx.advance(1000);
    report({ positionMs: 90_000 });
    report({ positionMs: 90_000, isPlaying: false });
    report({ index: 1, positionMs: 0 });

    expect(events.map((event) => [event.track.id, event.isPlaying, event.progressMs])).toEqual([
      ['aaaaaaaaaaa', true, 0],
      ['aaaaaaaaaaa', true, 90_000],
      ['aaaaaaaaaaa', false, 90_000],
      ['bbbbbbbbbbb', true, 0],
    ]);
  });

  test('nothing is known for someone who never played', async () => {
    const { service } = await setup();

    expect(await service.current('someone-else')).toBeNull();
  });
});
