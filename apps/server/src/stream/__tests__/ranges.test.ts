import { describe, expect, test } from 'bun:test';

import { CHUNK_BYTES, chunkedBody, chunksOf, parseRange } from '../ranges.ts';

describe('parseRange', () => {
  test.each([
    [null, { start: 0, end: 999 }],
    ['bytes=0-', { start: 0, end: 999 }],
    ['bytes=100-199', { start: 100, end: 199 }],
    ['bytes=900-5000', { start: 900, end: 999 }],
    ['bytes=-100', { start: 900, end: 999 }],
    ['bytes=1000-', null],
    ['bytes=5-2', null],
    ['items=0-1', null],
  ])('%s', (header, range) => {
    expect(parseRange(header, 1000)).toEqual(range);
  });
});

describe('chunks', () => {
  test('split covers the range exactly', () => {
    const chunks = chunksOf({ start: 10, end: CHUNK_BYTES * 2 + 5 });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.start).toBe(10);
    expect(chunks.at(-1)?.end).toBe(CHUNK_BYTES * 2 + 5);
  });

  test('body concatenates the upstream pieces in order', async () => {
    const data = new Uint8Array(CHUNK_BYTES + 10).map((_, index) => index % 251);
    const seen: string[] = [];
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const range = new Headers(init?.headers).get('range') ?? '';
      seen.push(range);
      const [, from, to] = /bytes=(\d+)-(\d+)/.exec(range) ?? [];

      return new Response(data.slice(Number(from), Number(to) + 1), { status: 206 });
    }) as typeof fetch;

    const body = chunkedBody(
      'https://x',
      { start: 5, end: CHUNK_BYTES + 9 },
      new AbortController().signal,
      fakeFetch,
    );
    const result = new Uint8Array(await new Response(body).arrayBuffer());

    expect(seen).toEqual([
      `bytes=5-${CHUNK_BYTES + 4}`,
      `bytes=${CHUNK_BYTES + 5}-${CHUNK_BYTES + 9}`,
    ]);
    expect(result).toEqual(data.slice(5, CHUNK_BYTES + 10));
  });
});
