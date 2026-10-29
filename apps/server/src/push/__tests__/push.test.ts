import { describe, expect, test } from 'bun:test';

import { PushMessage } from '@lyra/shared';

import { createApp } from '../../app.ts';
import { schema } from '../../db/index.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';
import { isPushEndpoint } from '../push.ts';
import type { PushSender } from '../push.ts';
import type { TestContext } from '../../testing/test-context.ts';

interface Sent {
  endpoint: string;
  message: PushMessage;
}

const PASSWORD = 'violet-harbor-71-quietly-ember';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';
const KEYS = { p256dh: 'BPublicKeyOfTheBrowser', auth: 'authSecret' };
// Real keys are not needed: the fake sender never encrypts anything.
const VAPID = { VAPID_PUBLIC_KEY: 'public-key', VAPID_PRIVATE_KEY: 'private-key' };

function setup(options: { hasKeys?: boolean; failWith?: number } = {}) {
  const base = createTestContext();
  const ctx: TestContext = {
    ...base,
    env: { ...base.env, ...(options.hasKeys === false ? {} : VAPID) },
  };
  const sent: Sent[] = [];
  const send: PushSender = async (subscription, payload) => {
    if (options.failWith) {
      throw Object.assign(new Error('push service'), { statusCode: options.failWith });
    }

    sent.push({ endpoint: subscription.endpoint, message: PushMessage.parse(JSON.parse(payload)) });

    return { statusCode: 201, body: '', headers: {} };
  };

  return { ctx, app: createApp(ctx, { pushSender: send }), sent };
}

async function signUp(ctx: TestContext, app: ReturnType<typeof createApp>, username: string) {
  const client = new TestClient(app);
  await client.request('POST', '/auth/register', {
    email: `${username}@example.com`,
    username,
    name: username === 'ana' ? 'Ana' : 'Bob',
    password: PASSWORD,
    language: username === 'bob' ? 'es' : 'en',
  });
  await client.request('POST', '/auth/verify-email', {
    token: linkToken(ctx.mailer.sent.at(-1)?.text ?? ''),
  });

  return client;
}

/** Notifications are sent without making the request wait, so tests wait for them. */
async function settle() {
  await Bun.sleep(20);
}

describe('push notifications', () => {
  test('a friend request and its acceptance notify the other person once', async () => {
    const { ctx, app, sent } = setup();
    const ana = await signUp(ctx, app, 'ana');
    const bob = await signUp(ctx, app, 'bob');
    await bob.request('POST', '/push/subscriptions', { endpoint: ENDPOINT, keys: KEYS });
    await ana.request('POST', '/push/subscriptions', {
      endpoint: `${ENDPOINT}-ana`,
      keys: KEYS,
    });

    await ana.request('POST', '/social/friends/bob');
    await settle();
    // Bob reads Lyra in Spanish.
    expect(sent).toEqual([
      {
        endpoint: ENDPOINT,
        message: {
          title: 'Nueva solicitud de amistad',
          body: 'Ana quiere ser tu amigo en Lyra.',
          url: '/friends',
          tag: 'friend-ana',
        },
      },
    ]);

    await bob.request('POST', '/social/friends/ana');
    await settle();
    expect(sent.at(-1)).toEqual({
      endpoint: `${ENDPOINT}-ana`,
      message: {
        title: 'Friend request accepted',
        body: 'Bob and you are now friends.',
        url: '/user/bob',
        tag: 'friend-bob',
      },
    });

    // Adding someone who is already a friend changes nothing, so nobody is notified again.
    await ana.request('POST', '/social/friends/bob');
    await settle();
    expect(sent).toHaveLength(2);
  });

  test('subscriptions the push service no longer knows are dropped', async () => {
    const { ctx, app } = setup({ failWith: 410 });
    const ana = await signUp(ctx, app, 'ana');
    const bob = await signUp(ctx, app, 'bob');
    await bob.request('POST', '/push/subscriptions', { endpoint: ENDPOINT, keys: KEYS });

    await ana.request('POST', '/social/friends/bob');
    await settle();

    expect(await ctx.db.select().from(schema.pushSubscriptions)).toEqual([]);
  });

  test('only real push services are accepted, and only with keys configured', async () => {
    const { ctx, app } = setup();
    const ana = await signUp(ctx, app, 'ana');

    const internal = await ana.request('POST', '/push/subscriptions', {
      endpoint: 'https://127.0.0.1/admin',
      keys: KEYS,
    });
    expect(internal.status).toBe(422);
    expect((await ana.request('GET', '/push/key')).body).toEqual({ publicKey: 'public-key' });

    const off = setup({ hasKeys: false });
    const bob = await signUp(off.ctx, off.app, 'bob');
    expect((await bob.request('GET', '/push/key')).body).toEqual({ publicKey: null });
    expect(
      (await bob.request('POST', '/push/subscriptions', { endpoint: ENDPOINT, keys: KEYS })).status,
    ).toBe(409);
  });

  test('unsubscribing removes only the caller’s own subscription', async () => {
    const { ctx, app } = setup();
    const ana = await signUp(ctx, app, 'ana');
    const bob = await signUp(ctx, app, 'bob');
    await ana.request('POST', '/push/subscriptions', { endpoint: ENDPOINT, keys: KEYS });

    await bob.request('DELETE', '/push/subscriptions', { endpoint: ENDPOINT });
    expect(await ctx.db.select().from(schema.pushSubscriptions)).toHaveLength(1);

    await ana.request('DELETE', '/push/subscriptions', { endpoint: ENDPOINT });
    expect(await ctx.db.select().from(schema.pushSubscriptions)).toEqual([]);
  });

  test('recognises the browsers’ push services', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
    expect(isPushEndpoint('https://evil.example.com/fcm.googleapis.com')).toBe(false);
    expect(isPushEndpoint('https://notfcm.googleapis.com.evil.com/')).toBe(false);
    expect(isPushEndpoint('http://fcm.googleapis.com/fcm/send/x')).toBe(false);
  });
});
