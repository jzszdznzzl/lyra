import { describe, expect, test } from 'bun:test';

import { createApp } from '../app.ts';
import { TestClient, createTestContext, linkToken } from '../testing/test-context.ts';

describe('query strings', () => {
  test('values with commas reach the handler as plain strings', async () => {
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

    // A comma in the URL used to make Elysia turn the value into an array and answer 422.
    const image = await client.request(
      'GET',
      `/images?url=${encodeURIComponent('https://evil.example.com/a,b.png')}`,
    );
    expect(image.status).toBe(400);

    const badFilter = await client.request('GET', '/music/search?q=hello,%20goodbye&filter=nope');
    expect(badFilter.status).toBe(422);
  });
});
