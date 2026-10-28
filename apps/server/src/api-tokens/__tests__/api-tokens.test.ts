import { describe, expect, test } from 'bun:test';

import { MAX_API_TOKENS, NowPlaying } from '@lyra/shared';

import { createApp } from '../../app.ts';
import { schema } from '../../db/index.ts';
import {
  TEST_ORIGIN,
  TestClient,
  createTestContext,
  linkToken,
} from '../../testing/test-context.ts';
import type { App } from '../../app.ts';
import type { TestContext } from '../../testing/test-context.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';
const TRACK = {
  kind: 'song',
  id: 'aaaaaaaaaaa',
  title: 'Get Lucky',
  artists: [{ id: 'UC1', name: 'Daft Punk' }],
  album: null,
  durationSeconds: 248,
  thumbnail: '/api/images/abcdefghijklmnopqrstuv',
  isExplicit: false,
};

async function signUp(ctx: TestContext, app: App) {
  const client = new TestClient(app);
  await client.request('POST', '/auth/register', {
    email: 'ana@example.com',
    username: 'ana',
    name: 'Ana',
    password: PASSWORD,
  });
  const verified = await client.request('POST', '/auth/verify-email', {
    token: linkToken(ctx.mailer.sent[0]?.text ?? ''),
  });

  return { client, userId: String(verified.body.id) };
}

/** A request from outside the app: no cookie, no Origin, just the token. */
function bearer(app: App, path: string, token: string) {
  return app.handle(
    new Request(`${TEST_ORIGIN}/api${path}`, { headers: { authorization: `Bearer ${token}` } }),
  );
}

function anonymous(app: App, path: string) {
  return app.handle(new Request(`${TEST_ORIGIN}/api${path}`));
}

describe('personal API tokens', () => {
  test('a token reads what its owner listens to until it is revoked', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const { client, userId } = await signUp(ctx, app);

    const created = await client.request('POST', '/tokens', { name: 'Discord' });
    expect(created.status).toBe(201);
    const token: string = created.body.token;
    expect(token.startsWith('lyra_')).toBe(true);
    expect(created.body.info.scopes).toEqual(['now-playing:read']);

    // Only the hash is stored.
    const [row] = await ctx.db.select().from(schema.apiTokens);
    expect(row?.tokenHash).not.toContain(token);

    expect((await bearer(app, '/me/now-playing', token)).status).toBe(204);

    await ctx.db.insert(schema.lastPlayed).values({ userId, track: TRACK, playedAt: ctx.now() });
    const playing = await bearer(app, '/me/now-playing', token);
    expect(playing.status).toBe(200);
    expect(playing.headers.get('access-control-allow-origin')).toBe('*');
    const body = NowPlaying.parse(await playing.json());
    expect(body.isPlaying).toBe(false);
    expect(body.track.title).toBe('Get Lucky');
    expect(body.track.coverUrl).toBe(`${TEST_ORIGIN}/api/images/abcdefghijklmnopqrstuv`);
    expect(body.track.youtubeMusicUrl).toBe('https://music.youtube.com/watch?v=aaaaaaaaaaa');

    const listed = await client.request('GET', '/tokens');
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].lastUsedAt).toBe(ctx.now());
    expect(JSON.stringify(listed.body)).not.toContain(token);

    expect((await client.request('DELETE', `/tokens/${listed.body[0].id}`)).status).toBe(204);
    expect((await bearer(app, '/me/now-playing', token)).status).toBe(401);
  });

  test('the event stream starts with the current song', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const { client, userId } = await signUp(ctx, app);
    const token: string = (await client.request('POST', '/tokens', { name: 'Discord' })).body.token;
    await ctx.db.insert(schema.lastPlayed).values({ userId, track: TRACK, playedAt: ctx.now() });

    const response = await bearer(app, '/me/now-playing/events', token);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    const reader = response.body?.getReader();
    const first = await reader?.read();
    await reader?.cancel();

    const text = new TextDecoder().decode(first?.value);
    expect(text.startsWith('event: now-playing\ndata: ')).toBe(true);
    expect(text).toContain('"title":"Get Lucky"');
  });

  test('wrong tokens, sessions and other users are refused', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const { client } = await signUp(ctx, app);

    expect((await bearer(app, '/me/now-playing', 'lyra_nope')).status).toBe(401);
    expect((await anonymous(app, '/me/now-playing')).status).toBe(401);
    // The session cookie is not a token: another site cannot read it through the browser.
    expect((await client.request('GET', '/me/now-playing')).status).toBe(401);
    expect((await anonymous(app, '/tokens')).status).toBe(401);
  });

  test('tokens are capped per account', async () => {
    const ctx = createTestContext();
    const { client } = await signUp(ctx, createApp(ctx));

    for (let index = 0; index < MAX_API_TOKENS; index += 1) {
      expect((await client.request('POST', '/tokens', { name: `t${index}` })).status).toBe(201);
    }

    const extra = await client.request('POST', '/tokens', { name: 'one too many' });
    expect(extra.status).toBe(409);
    expect(extra.body.error).toBe('too_many_tokens');
  });
});

describe('public now-playing widget', () => {
  test('stays hidden until the owner turns it on', async () => {
    const ctx = createTestContext();
    const app = createApp(ctx);
    const { client, userId } = await signUp(ctx, app);
    await ctx.db.insert(schema.lastPlayed).values({ userId, track: TRACK, playedAt: ctx.now() });

    expect((await anonymous(app, '/u/ana/now-playing.svg')).status).toBe(404);
    expect((await anonymous(app, '/u/ana/now-playing.json')).status).toBe(404);

    const updated = await client.request('PATCH', '/me', { isNowPlayingPublic: true });
    expect(updated.body.isNowPlayingPublic).toBe(true);

    const svg = await anonymous(app, '/u/ana/now-playing.svg?theme=light');
    expect(svg.status).toBe(200);
    expect(svg.headers.get('content-type')).toContain('image/svg+xml');
    expect(await svg.text()).toContain('Get Lucky');

    const json = await anonymous(app, '/u/ana/now-playing.json');
    expect(NowPlaying.parse(await json.json()).track.title).toBe('Get Lucky');

    expect((await anonymous(app, '/u/ana/now-playing.svg?theme=pink')).status).toBe(422);
    expect((await anonymous(app, '/u/nobody/now-playing.svg')).status).toBe(404);
  });
});
