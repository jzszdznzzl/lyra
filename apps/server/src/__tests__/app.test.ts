import { describe, expect, test } from 'bun:test';

import { createApp } from '../app.ts';
import { TestClient, createTestContext } from '../testing/test-context.ts';

describe('app', () => {
  test('health answers ok', async () => {
    const client = new TestClient(createApp(createTestContext()));

    expect(await client.request('GET', '/health')).toEqual({ status: 200, body: { status: 'ok' } });
  });
});
