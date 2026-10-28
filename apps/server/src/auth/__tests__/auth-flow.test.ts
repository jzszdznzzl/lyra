import { beforeEach, describe, expect, test } from 'bun:test';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';
import type { TestContext } from '../../testing/test-context.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';
const NEW_PASSWORD = 'copper-lantern-38-softly-river';
const ACCOUNT = { email: 'Ana@Example.com', username: 'ana_m', name: 'Ana', password: PASSWORD };

let ctx: TestContext;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  ctx = createTestContext();
  app = createApp(ctx);
});

async function registerAndVerify(client = new TestClient(app)) {
  await client.request('POST', '/auth/register', ACCOUNT);
  const mail = ctx.mailer.sent.at(-1);
  await client.request('POST', '/auth/verify-email', { token: linkToken(mail?.text ?? '') });

  return client;
}

describe('registration', () => {
  test('registers, sends a verification link and signs in after verifying', async () => {
    const client = new TestClient(app);

    const registered = await client.request('POST', '/auth/register', ACCOUNT);
    expect(registered).toEqual({ status: 201, body: { email: 'ana@example.com' } });
    expect(ctx.mailer.sent).toHaveLength(1);

    const beforeVerify = await client.request('POST', '/auth/login', {
      identifier: 'ana_m',
      password: PASSWORD,
    });
    expect(beforeVerify).toEqual({ status: 403, body: { error: 'email_not_verified' } });

    const verified = await client.request('POST', '/auth/verify-email', {
      token: linkToken(ctx.mailer.sent[0]?.text ?? ''),
    });
    expect(verified.status).toBe(200);
    expect(verified.body.username).toBe('ana_m');

    const me = await client.request('GET', '/me');
    expect(me.body.email).toBe('ana@example.com');
  });

  test('rejects disposable emails, weak passwords and duplicates', async () => {
    const client = new TestClient(app);

    expect(
      (await client.request('POST', '/auth/register', { ...ACCOUNT, email: 'a@mailinator.com' }))
        .body,
    ).toEqual({ error: 'disposable_email' });
    expect(
      (await client.request('POST', '/auth/register', { ...ACCOUNT, password: 'password1234' }))
        .body,
    ).toEqual({ error: 'weak_password' });

    await client.request('POST', '/auth/register', ACCOUNT);

    expect((await client.request('POST', '/auth/register', ACCOUNT)).body).toEqual({
      error: 'email_taken',
    });
    expect(
      (await client.request('POST', '/auth/register', { ...ACCOUNT, email: 'other@example.com' }))
        .body,
    ).toEqual({ error: 'username_taken' });
  });

  test('a verification link works only once', async () => {
    const client = new TestClient(app);
    await client.request('POST', '/auth/register', ACCOUNT);
    const token = linkToken(ctx.mailer.sent[0]?.text ?? '');

    expect((await client.request('POST', '/auth/verify-email', { token })).status).toBe(200);
    expect((await client.request('POST', '/auth/verify-email', { token })).body).toEqual({
      error: 'invalid_token',
    });
  });
});

describe('sessions', () => {
  test('lists sessions and revokes the others', async () => {
    const phone = await registerAndVerify(
      new TestClient(app, 'Mozilla/5.0 (Linux; Android 15) Chrome/141.0 Mobile Safari/537.36'),
    );
    const pc = new TestClient(app);
    await pc.request('POST', '/auth/login', { identifier: 'ana@example.com', password: PASSWORD });

    const sessions = await pc.request('GET', '/sessions');
    expect(sessions.body).toHaveLength(2);
    expect(sessions.body.map((s: { device: string }) => s.device).sort()).toEqual([
      'Chrome on Android',
      'Chrome on Linux',
    ]);

    expect((await pc.request('DELETE', '/sessions')).status).toBe(204);
    expect((await phone.request('GET', '/me')).status).toBe(401);
    expect((await pc.request('GET', '/me')).status).toBe(200);
  });

  test('logout ends only the current session', async () => {
    const client = await registerAndVerify();

    expect((await client.request('POST', '/auth/logout')).status).toBe(204);
    expect(client.cookie).toBe('');
    expect((await client.request('GET', '/me')).status).toBe(401);
  });

  test('wrong passwords answer the same as unknown users and get rate limited', async () => {
    const client = await registerAndVerify();
    const wrong = { identifier: 'ana_m', password: 'not-the-password' };
    const unknown = { identifier: 'nobody', password: 'not-the-password' };

    expect((await client.request('POST', '/auth/login', wrong)).body).toEqual(
      (await client.request('POST', '/auth/login', unknown)).body,
    );

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await client.request('POST', '/auth/login', wrong);
    }

    expect((await client.request('POST', '/auth/login', wrong)).status).toBe(429);
  });
});

describe('profile', () => {
  test('updates name and language', async () => {
    const client = await registerAndVerify();
    const updated = await client.request('PATCH', '/me', { name: 'Ana María', language: 'es' });

    expect(updated.body).toMatchObject({ name: 'Ana María', language: 'es' });
  });

  test('changing the password signs out other devices', async () => {
    const phone = await registerAndVerify();
    const pc = new TestClient(app);
    await pc.request('POST', '/auth/login', { identifier: 'ana_m', password: PASSWORD });

    const wrongCurrent = await pc.request('POST', '/me/password', {
      currentPassword: 'nope',
      newPassword: NEW_PASSWORD,
    });
    expect(wrongCurrent.status).toBe(401);

    const changed = await pc.request('POST', '/me/password', {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(changed.status).toBe(204);
    expect((await phone.request('GET', '/me')).status).toBe(401);
    expect((await pc.request('GET', '/me')).status).toBe(200);
  });

  test('uploads, serves and deletes an avatar', async () => {
    const client = await registerAndVerify();
    const png = await new Response(
      Bun.file(new URL('./fixtures/avatar.png', import.meta.url).pathname),
    ).arrayBuffer();
    const form = new FormData();
    form.set('file', new File([png], 'avatar.png', { type: 'image/png' }));

    const uploaded = await client.request('PUT', '/me/avatar', form);
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.avatarUrl).toMatch(/^\/api\/avatars\/[\w-]+\.webp\?v=1$/);

    const path = uploaded.body.avatarUrl.replace('/api', '').split('?')[0];
    const served = await client.request('GET', path);
    expect(served.status).toBe(200);

    const removed = await client.request('DELETE', '/me/avatar');
    expect(removed.body.avatarUrl).toBeNull();
  });

  test('rejects files that are not images', async () => {
    const client = await registerAndVerify();
    const form = new FormData();
    form.set('file', new File(['hello'], 'avatar.png', { type: 'image/png' }));

    expect((await client.request('PUT', '/me/avatar', form)).body).toEqual({
      error: 'invalid_image',
    });
  });
});

describe('password reset', () => {
  test('resets the password and signs out everywhere', async () => {
    const client = await registerAndVerify();
    const stranger = new TestClient(app);

    expect(
      (await stranger.request('POST', '/auth/forgot-password', { email: 'ana@example.com' }))
        .status,
    ).toBe(204);
    expect(
      (await stranger.request('POST', '/auth/forgot-password', { email: 'ghost@example.com' }))
        .status,
    ).toBe(204);

    const token = linkToken(ctx.mailer.sent.at(-1)?.text ?? '');

    expect(
      (await stranger.request('POST', '/auth/reset-password', { token, password: 'password1234' }))
        .body,
    ).toEqual({ error: 'weak_password' });
    expect(
      (await stranger.request('POST', '/auth/reset-password', { token, password: NEW_PASSWORD }))
        .status,
    ).toBe(204);

    expect((await client.request('GET', '/me')).status).toBe(401);
    expect(
      (
        await stranger.request('POST', '/auth/login', {
          identifier: 'ana_m',
          password: NEW_PASSWORD,
        })
      ).status,
    ).toBe(200);
  });

  test('reset links expire after an hour', async () => {
    const client = await registerAndVerify();
    await client.request('POST', '/auth/forgot-password', { email: 'ana@example.com' });
    const token = linkToken(ctx.mailer.sent.at(-1)?.text ?? '');

    ctx.advance(61 * 60 * 1000);

    expect(
      (await client.request('POST', '/auth/reset-password', { token, password: NEW_PASSWORD }))
        .body,
    ).toEqual({ error: 'invalid_token' });
  });
});

describe('closed registration', () => {
  test('refuses sign-ups and says so in the public config', async () => {
    const closed = createTestContext();
    const closedApp = createApp({ ...closed, env: { ...closed.env, REGISTRATION_ENABLED: false } });
    const client = new TestClient(closedApp);

    expect((await client.request('GET', '/config')).body).toEqual({ isRegistrationEnabled: false });
    expect(await client.request('POST', '/auth/register', ACCOUNT)).toEqual({
      status: 403,
      body: { error: 'registration_closed' },
    });
    expect(closed.mailer.sent).toHaveLength(0);
  });
});
