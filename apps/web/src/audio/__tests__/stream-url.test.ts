import { afterEach, describe, expect, test, vi } from 'vitest';

import { MusicError } from '@lyra/shared';

import { streamFailure } from '../stream-url.ts';

function answer(response: Response | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (response instanceof Error) {
        throw response;
      }

      return response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamFailure', () => {
  test('reads the reason the server gave', async () => {
    answer(Response.json({ error: MusicError.GoogleNotLinked }, { status: 403 }));

    expect(await streamFailure('/api/stream/abc')).toBe(MusicError.GoogleNotLinked);
  });

  test('asks for a single byte, so a working stream is not downloaded', async () => {
    answer(new Response('x', { status: 206 }));

    expect(await streamFailure('/api/stream/abc')).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/stream/abc', {
      headers: { range: 'bytes=0-0' },
      credentials: 'same-origin',
    });
  });

  test.each([
    ['an unknown body', new Response('oops', { status: 502 })],
    ['a network failure', new Error('offline')],
  ])('gives no reason for %s', async (_, response) => {
    answer(response);

    expect(await streamFailure('/api/stream/abc')).toBeNull();
  });
});
