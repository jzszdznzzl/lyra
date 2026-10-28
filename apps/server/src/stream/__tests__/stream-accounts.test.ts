import { describe, expect, test } from 'bun:test';
import type { Innertube } from 'youtubei.js';

import { MusicError, err, ok } from '@lyra/shared';
import type { Result } from '@lyra/shared';

import { StreamAccounts } from '../stream-accounts.ts';
import type { StreamClient } from '../stream-accounts.ts';

// The accounts only pass clients around, so empty stand-ins are enough.
const anonymousYt = {} as Innertube;
const ownYt = {} as Innertube;
const fallbackYt = {} as Innertube;

const anonymous: StreamClient = { yt: anonymousYt, cacheKey: 'user-1', isSignedIn: false };
const linked: StreamClient = { yt: ownYt, cacheKey: 'user-2', isSignedIn: true };

function setup(fallback: Innertube | null, answers: Map<Innertube, Result<string, MusicError>>) {
  let now = 0;
  const calls: string[] = [];
  const accounts = new StreamAccounts(
    () => now,
    async () => fallback,
  );
  const resolve = async (client: StreamClient) => {
    calls.push(client.cacheKey);

    return answers.get(client.yt) ?? err(MusicError.Upstream);
  };

  return {
    calls,
    resolve: () => accounts.resolve(anonymous, resolve),
    resolveLinked: () => accounts.resolve(linked, resolve),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('StreamAccounts', () => {
  test('a linked user always uses their own account', async () => {
    const { calls, resolveLinked } = setup(
      fallbackYt,
      new Map<Innertube, Result<string, MusicError>>([
        [ownYt, err(MusicError.GoogleSessionExpired)],
      ]),
    );

    expect((await resolveLinked()).error).toBe(MusicError.GoogleSessionExpired);
    expect(calls).toEqual(['user-2']);
  });

  test('anonymous playback stays anonymous while YouTube allows it', async () => {
    const { calls, resolve } = setup(
      fallbackYt,
      new Map<Innertube, Result<string, MusicError>>([[anonymousYt, ok('song')]]),
    );

    expect((await resolve()).data?.stream).toBe('song');
    expect(calls).toEqual(['user-1']);
  });

  test('a sign-in request moves anonymous users to the shared fallback account', async () => {
    const { calls, resolve, advance } = setup(
      fallbackYt,
      new Map<Innertube, Result<string, MusicError>>([
        [anonymousYt, err(MusicError.GoogleNotLinked)],
        [fallbackYt, ok('song')],
      ]),
    );

    const first = await resolve();
    expect(first.data?.stream).toBe('song');
    expect(first.data?.client.cacheKey).toBe('stream-fallback');

    // Known blocked: the next song skips the anonymous attempt.
    await resolve();
    // Half an hour later, anonymous gets another chance.
    advance(31 * 60 * 1000);
    await resolve();

    expect(calls).toEqual([
      'user-1',
      'stream-fallback',
      'stream-fallback',
      'user-1',
      'stream-fallback',
    ]);
  });

  test('without a fallback the user is asked to link Google', async () => {
    const { resolve } = setup(
      null,
      new Map<Innertube, Result<string, MusicError>>([
        [anonymousYt, err(MusicError.GoogleNotLinked)],
      ]),
    );

    expect((await resolve()).error).toBe(MusicError.GoogleNotLinked);
  });

  test('an expired fallback session also asks the user to link Google', async () => {
    const { resolve } = setup(
      fallbackYt,
      new Map<Innertube, Result<string, MusicError>>([
        [anonymousYt, err(MusicError.GoogleNotLinked)],
        [fallbackYt, err(MusicError.GoogleSessionExpired)],
      ]),
    );

    expect((await resolve()).error).toBe(MusicError.GoogleNotLinked);
  });

  test('other errors are not retried with the fallback', async () => {
    const { calls, resolve } = setup(
      fallbackYt,
      new Map<Innertube, Result<string, MusicError>>([[anonymousYt, err(MusicError.Unavailable)]]),
    );

    expect((await resolve()).error).toBe(MusicError.Unavailable);
    expect(calls).toEqual(['user-1']);
  });
});
