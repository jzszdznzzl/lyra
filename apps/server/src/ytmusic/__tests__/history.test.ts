import { describe, expect, test } from 'bun:test';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';

describe('YouTube history', () => {
  test('is on by default and answers right away, even without Google', async () => {
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

    expect((await client.request('GET', '/me')).body.isYoutubeHistoryEnabled).toBe(true);
    expect((await client.request('POST', '/music/history/aaaaaaaaaaa')).status).toBe(204);

    const off = await client.request('PATCH', '/me', { isYoutubeHistoryEnabled: false });
    expect(off.body.isYoutubeHistoryEnabled).toBe(false);
  });
});
