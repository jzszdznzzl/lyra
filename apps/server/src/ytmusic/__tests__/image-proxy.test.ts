import { describe, expect, test } from 'bun:test';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';

async function signedIn() {
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

  return client;
}

const path = (url: string) => `/images?url=${encodeURIComponent(url)}`;

describe('image proxy', () => {
  test('requires a session', async () => {
    const client = new TestClient(createApp(createTestContext()));

    expect((await client.request('GET', path('https://i.ytimg.com/vi/x/hq.jpg'))).status).toBe(401);
  });

  test('refuses hosts outside the YouTube CDNs and plain http', async () => {
    const client = await signedIn();

    expect((await client.request('GET', path('https://evil.example.com/a.png'))).status).toBe(400);
    expect((await client.request('GET', path('http://i.ytimg.com/vi/x/hq.jpg'))).status).toBe(422);
  });
});
