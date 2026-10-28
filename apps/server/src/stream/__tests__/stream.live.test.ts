import { describe, expect, test } from 'bun:test';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';

const isLive = process.env['LYRA_LIVE'] === '1';

describe.skipIf(!isLive)('stream (live)', () => {
  test('serves byte ranges of a real song and the up-next radio', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const client = new TestClient(app);
    await client.request('POST', '/auth/register', {
      email: 'ana@example.com',
      username: 'ana',
      name: 'Ana',
      password: 'violet-harbor-71-quietly-ember',
    });
    await client.request('POST', '/auth/verify-email', {
      token: linkToken(ctx.mailer.sent[0]?.text ?? ''),
    });

    const response = await app.handle(
      new Request('http://localhost:44790/api/stream/4D7u5KF7SP8?quality=high', {
        headers: { cookie: client.cookie, range: 'bytes=0-' },
      }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get('content-type')).toStartWith('audio/webm');
    // Past the first MiB is where googlevideo refuses clients without a PO token.
    expect((await response.arrayBuffer()).byteLength).toBe(
      Number(response.headers.get('content-length')),
    );
    expect(Number(response.headers.get('content-length'))).toBeGreaterThan(2 * 1024 * 1024);
    expect(response.headers.get('x-lyra-loudness-db')).not.toBeNull();

    const upNext = await client.request('GET', '/music/up-next/4D7u5KF7SP8');
    expect(upNext.body.tracks.length).toBeGreaterThan(5);
  }, 60_000);
});
