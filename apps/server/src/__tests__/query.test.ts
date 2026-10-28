import { describe, expect, test } from 'bun:test';

import { SearchQuery } from '@lyra/shared';

import { createApp } from '../app.ts';
import { parseQuery } from '../query.ts';
import { TestClient, createTestContext, linkToken } from '../testing/test-context.ts';

describe('query strings', () => {
  test('values with commas stay plain strings', () => {
    // Elysia's own query validation would have turned this into ['Hello', ' Goodbye'].
    expect(parseQuery(SearchQuery, { q: 'Hello, Goodbye', filter: 'songs' })).toEqual({
      q: 'Hello, Goodbye',
      filter: 'songs',
    });
  });

  test('invalid queries answer 422', async () => {
    const ctx = createTestContext();
    const client = new TestClient(createApp(ctx));
    await client.request('POST', '/auth/register', {
      email: 'ana@example.com',
      username: 'ana',
      name: 'Ana',
      password: 'violet-harbor-71-quietly-ember',
    });
    await client.request('POST', '/auth/verify-email', {
      token: linkToken(ctx.mailer.sent[0]?.text ?? ''),
    });

    expect(
      (await client.request('GET', '/music/search?q=hello,%20goodbye&filter=nope')).status,
    ).toBe(422);
  });
});
