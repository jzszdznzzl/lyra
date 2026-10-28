import { describe, expect, test } from 'bun:test';

import { findLrclibLyrics } from '../lyrics.ts';

function fakeLrclib(routes: Record<string, unknown>) {
  return (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const body = routes[url.pathname];

    return body === undefined
      ? new Response('{}', { status: 404 })
      : new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const QUERY = { title: 'Song', artist: 'Band', album: 'Album', duration: 200 };

describe('findLrclibLyrics', () => {
  test('uses the exact match when it has synced lyrics', async () => {
    const lyrics = await findLrclibLyrics(
      QUERY,
      fakeLrclib({
        '/api/get': {
          duration: 200,
          instrumental: false,
          plainLyrics: 'a',
          syncedLyrics: '[00:01.00]a',
        },
      }),
    );

    expect(lyrics).toEqual({
      source: 'lrclib',
      isSynced: true,
      lines: [{ timeMs: 1000, text: 'a' }],
    });
  });

  test('falls back to search and skips results with another length', async () => {
    const lyrics = await findLrclibLyrics(
      QUERY,
      fakeLrclib({
        '/api/search': [
          {
            duration: 120,
            instrumental: false,
            plainLyrics: 'wrong',
            syncedLyrics: '[00:01.00]wrong',
          },
          { duration: 201, instrumental: false, plainLyrics: 'right', syncedLyrics: null },
        ],
      }),
    );

    expect(lyrics).toEqual({
      source: 'lrclib',
      isSynced: false,
      lines: [{ timeMs: null, text: 'right' }],
    });
  });

  test('returns null when nothing matches', async () => {
    expect(await findLrclibLyrics(QUERY, fakeLrclib({ '/api/search': [] }))).toBeNull();
  });
});
