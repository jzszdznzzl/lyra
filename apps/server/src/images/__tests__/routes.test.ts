import { describe, expect, test } from 'bun:test';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext } from '../../testing/test-context.ts';

describe('image route', () => {
  test('only serves ids the server issued, and takes no URLs', async () => {
    const client = new TestClient(createApp(createTestContext()));

    expect((await client.request('GET', '/images/AAAAAAAAAAAAAAAAAAAAAA')).status).toBe(404);
    expect((await client.request('GET', '/images/not-an-id')).status).toBe(422);
    expect(
      (
        await client.request(
          'GET',
          `/images?url=${encodeURIComponent('https://i.ytimg.com/vi/x/hq.jpg')}`,
        )
      ).status,
    ).toBe(404);
  });
});
