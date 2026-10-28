import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';

import { RemoteLogin } from '../remote-login.ts';

// A local page plays Google: typing a name and pressing Enter "signs in" and redirects.
const LOGIN_PAGE = `<!doctype html><html><body>
<input id="name" autofocus style="position:absolute;left:10px;top:10px;width:200px;height:40px">
<script>
document.getElementById('name').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    document.cookie = 'SAPISID=abc123; path=/';
    location.href = '/done';
  }
});
</script></body></html>`;

let server: Server<unknown>;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch: (request) =>
      new URL(request.url).pathname === '/done'
        ? new Response('<p>done</p>', { headers: { 'content-type': 'text/html' } })
        : new Response(LOGIN_PAGE, { headers: { 'content-type': 'text/html' } }),
  });
});

afterAll(async () => {
  await server.stop(true);
});

describe('RemoteLogin', () => {
  test('streams frames, forwards input and captures the session cookie', async () => {
    const origin = `http://localhost:${server.port}`;
    let frames = 0;
    const cookie = Promise.withResolvers<string>();

    const session = await RemoteLogin.start(
      'ana',
      { startUrl: `${origin}/login`, doneUrl: /\/done$/, cookieUrl: origin },
      {
        onFrame: () => {
          frames += 1;
        },
        onCookie: cookie.resolve,
        onClosed: () => undefined,
      },
    );

    expect(session).not.toBeNull();
    expect(RemoteLogin.isBusy).toBe(true);
    expect(
      await RemoteLogin.start(
        'bea',
        { startUrl: origin, doneUrl: /x/, cookieUrl: origin },
        { onFrame: () => undefined, onCookie: () => undefined, onClosed: () => undefined },
      ),
    ).toBeNull();

    await session?.handle({ type: 'click', x: 50, y: 30 });
    await session?.handle({ type: 'text', text: 'ana' });
    await session?.handle({ type: 'key', key: 'Enter' });

    expect(await cookie.promise).toBe('SAPISID=abc123');
    expect(frames).toBeGreaterThan(0);
    expect(RemoteLogin.isBusy).toBe(false);
  }, 30_000);

  test('replaces an abandoned sign-in of the same user instead of reporting busy', async () => {
    const origin = `http://localhost:${server.port}`;
    const target = { startUrl: `${origin}/login`, doneUrl: /\/done$/, cookieUrl: origin };
    let closedCount = 0;
    const handlers = {
      onFrame: () => undefined,
      onCookie: () => undefined,
      onClosed: () => {
        closedCount += 1;
      },
    };

    const abandoned = await RemoteLogin.start('ana', target, handlers);
    const fresh = await RemoteLogin.start('ana', target, handlers);

    expect(abandoned).not.toBeNull();
    expect(fresh).not.toBeNull();
    expect(closedCount).toBe(1);
    expect(RemoteLogin.isBusy).toBe(true);

    await fresh?.close();
    expect(RemoteLogin.isBusy).toBe(false);
  }, 30_000);
});
