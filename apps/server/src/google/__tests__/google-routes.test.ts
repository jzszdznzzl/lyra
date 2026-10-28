import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';
const FAKE_LOGIN = `<!doctype html><body><button style="width:300px;height:300px"
onclick="document.cookie='SAPISID=fake; path=/'; location.href='/done'">Sign in</button></body>`;

let fakeGoogle: Server<unknown>;

beforeAll(() => {
  fakeGoogle = Bun.serve({
    port: 0,
    fetch: () => new Response(FAKE_LOGIN, { headers: { 'content-type': 'text/html' } }),
  });
});

afterAll(async () => {
  await fakeGoogle.stop(true);
});

async function signedInClient(
  app: ReturnType<typeof createApp>,
  ctx: ReturnType<typeof createTestContext>,
) {
  const client = new TestClient(app);
  await client.request('POST', '/auth/register', {
    email: 'ana@example.com',
    username: 'ana',
    name: 'Ana',
    password: PASSWORD,
  });
  await client.request('POST', '/auth/verify-email', {
    token: linkToken(ctx.mailer.sent[0]?.text ?? ''),
  });

  return client;
}

describe('google routes', () => {
  test('status starts unlinked and fake cookies are rejected', async () => {
    const ctx = createTestContext();
    const client = await signedInClient(createApp(ctx), ctx);

    expect((await client.request('GET', '/google')).body).toEqual({ account: null });
    expect(
      (
        await client.request('POST', '/google/cookies', {
          cookie: 'PREF=hl=en; VISITOR=abcdefghijk',
        })
      ).body,
    ).toEqual({
      error: 'invalid_cookies',
    });
  });

  test('remote browser streams frames and reports the captured session', async () => {
    const ctx = createTestContext();
    const origin = `http://localhost:${fakeGoogle.port}`;
    const app = createApp(ctx, {
      loginTarget: { startUrl: origin, doneUrl: /\/done$/, cookieUrl: origin },
    });
    const client = await signedInClient(app, ctx);
    const server = app.listen(0);
    const messages: { type: string; error?: string }[] = [];
    const closed = Promise.withResolvers<void>();

    const socket = new WebSocket(`ws://localhost:${server.server?.port}/api/google/browser`, {
      headers: { cookie: client.cookie },
    });
    socket.addEventListener('message', (event) => {
      const message: { type: string; error?: string } = JSON.parse(String(event.data));
      messages.push(message);

      // Early frames can show a blank page, so keep clicking until the sign-in lands.
      if (message.type === 'frame' && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'click', x: 100, y: 100 }));
      }
    });
    socket.addEventListener('close', () => closed.resolve());

    await closed.promise;
    await server.stop();

    expect(messages.some((message) => message.type === 'frame')).toBe(true);
    // The fake cookie reaches the real verification, which correctly refuses it.
    expect(messages.at(-1)).toMatchObject({ type: 'error' });
  }, 60_000);

  test('rejects the socket without a session', async () => {
    const app = createApp(createTestContext());
    const server = app.listen(0);
    const socket = new WebSocket(`ws://localhost:${server.server?.port}/api/google/browser`);
    const result = Promise.withResolvers<string>();
    socket.addEventListener('open', () => result.resolve('open'));
    socket.addEventListener('error', () => result.resolve('error'));
    socket.addEventListener('close', () => result.resolve('close'));

    expect(await result.promise).not.toBe('open');
    await server.stop();
  });
});
