import { describe, expect, test } from 'bun:test';

import { createApp } from '../app.ts';
import { TEST_ORIGIN, createTestContext } from '../testing/test-context.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';

function post(app: ReturnType<typeof createApp>, path: string, origin: string | null) {
  const headers = new Headers({ 'content-type': 'application/json' });

  if (origin) {
    headers.set('origin', origin);
  }

  return app.handle(
    new Request(`${TEST_ORIGIN}/api${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ identifier: 'x', password: PASSWORD }),
    }),
  );
}

describe('origin guard', () => {
  test('refuses writes from other sites or without an origin', async () => {
    const app = createApp(createTestContext());

    expect((await post(app, '/auth/login', 'https://evil.example.com')).status).toBe(403);
    expect((await post(app, '/auth/login', null)).status).toBe(403);
    expect((await post(app, '/auth/login', TEST_ORIGIN)).status).toBe(401);
  });

  test('refuses WebSocket upgrades from other sites', async () => {
    const app = createApp(createTestContext());
    const response = await app.handle(
      new Request(`${TEST_ORIGIN}/api/connect`, {
        headers: { upgrade: 'websocket', origin: 'https://evil.example.com' },
      }),
    );

    expect(response.status).toBe(403);
  });

  test('sends security headers', async () => {
    const response = await createApp(createTestContext()).handle(
      new Request(`${TEST_ORIGIN}/api/health`),
    );

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });
});
