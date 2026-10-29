import { describe, expect, test } from 'bun:test';

import { FriendStatus, FriendsOverview, SocialError, UserPage } from '@lyra/shared';

import { createApp } from '../../app.ts';
import { TestClient, createTestContext, linkToken } from '../../testing/test-context.ts';
import { markJoined, saveSharedPlaylist } from '../friends.ts';
import type { App } from '../../app.ts';
import type { TestContext } from '../../testing/test-context.ts';

const PASSWORD = 'violet-harbor-71-quietly-ember';

async function signUp(ctx: TestContext, app: App, username: string) {
  const client = new TestClient(app);
  await client.request('POST', '/auth/register', {
    email: `${username}@example.com`,
    username,
    name: username.toUpperCase(),
    password: PASSWORD,
  });
  const verified = await client.request('POST', '/auth/verify-email', {
    token: linkToken(ctx.mailer.sent.at(-1)?.text ?? ''),
  });

  return { client, userId: String(verified.body.id) };
}

async function twoUsers() {
  const ctx = createTestContext();
  const app = createApp(ctx);
  const ana = await signUp(ctx, app, 'ana');
  const bob = await signUp(ctx, app, 'bob');

  return { ctx, ana, bob };
}

async function overview(client: TestClient) {
  return FriendsOverview.parse((await client.request('GET', '/social/friends')).body);
}

describe('friends', () => {
  test('a request becomes a friendship once the other person accepts', async () => {
    const { ana, bob } = await twoUsers();

    const sent = await ana.client.request('POST', '/social/friends/bob');
    expect(sent.body).toEqual({ status: FriendStatus.Outgoing });
    expect((await overview(ana.client)).outgoing.map((user) => user.username)).toEqual(['bob']);
    expect((await overview(bob.client)).incoming.map((user) => user.username)).toEqual(['ana']);

    const accepted = await bob.client.request('POST', '/social/friends/ana');
    expect(accepted.body).toEqual({ status: FriendStatus.Friends });
    expect((await overview(ana.client)).friends.map((user) => user.username)).toEqual(['bob']);
    expect((await overview(bob.client)).incoming).toEqual([]);
  });

  test('a profile shows its music only to friends', async () => {
    const { ana, bob } = await twoUsers();

    const stranger = UserPage.parse((await ana.client.request('GET', '/social/users/bob')).body);
    expect(stranger.status).toBe(FriendStatus.None);
    expect(stranger.sharedPlaylists).toEqual([]);
    expect((await ana.client.request('GET', '/social/users/bob/music')).status).toBe(403);

    await ana.client.request('POST', '/social/friends/bob');
    await bob.client.request('POST', '/social/friends/ana');

    const friend = UserPage.parse((await ana.client.request('GET', '/social/users/bob')).body);
    expect(friend.status).toBe(FriendStatus.Friends);
    // Bob has no Google account linked, so his music is empty rather than an error.
    const music = await ana.client.request('GET', '/social/users/bob/music');
    expect(music.body).toEqual({ recent: null, publicPlaylists: [] });
  });

  test('unfriending, unknown people and oneself', async () => {
    const { ana, bob } = await twoUsers();
    await ana.client.request('POST', '/social/friends/bob');
    await bob.client.request('POST', '/social/friends/ana');

    expect((await bob.client.request('DELETE', '/social/friends/ana')).status).toBe(204);
    expect((await overview(ana.client)).friends).toEqual([]);
    expect((await ana.client.request('GET', '/social/users/nobody')).status).toBe(404);

    const self = await ana.client.request('POST', '/social/friends/ana');
    expect(self.status).toBe(422);
    expect(self.body).toEqual({ error: SocialError.Self });
  });

  test('a shared playlist needs a friend', async () => {
    const { ana } = await twoUsers();

    const created = await ana.client.request('POST', '/social/playlists', {
      title: 'Road trip',
      username: 'bob',
    });
    expect(created.status).toBe(403);
  });

  test('invitations wait until joined, and joined playlists are shared on both profiles', async () => {
    const { ctx, ana, bob } = await twoUsers();
    await ana.client.request('POST', '/social/friends/bob');
    await bob.client.request('POST', '/social/friends/ana');
    await saveSharedPlaylist(ctx, {
      id: 'PLroadtrip',
      title: 'Road trip',
      inviteToken: 'token',
      ownerId: ana.userId,
      friendId: bob.userId,
    });

    const invites = (await overview(bob.client)).invites;
    expect(invites.map((invite) => [invite.title, invite.from.username])).toEqual([
      ['Road trip', 'ana'],
    ]);
    expect(
      UserPage.parse((await ana.client.request('GET', '/social/users/bob')).body).sharedPlaylists,
    ).toEqual([]);

    await markJoined(ctx, bob.userId, 'PLroadtrip');

    expect((await overview(bob.client)).invites).toEqual([]);
    const shared = UserPage.parse(
      (await bob.client.request('GET', '/social/users/ana')).body,
    ).sharedPlaylists;
    expect(shared.map((playlist) => [playlist.title, playlist.members.length])).toEqual([
      ['Road trip', 2],
    ]);
  });

  test('declining an invitation removes it', async () => {
    const { ctx, ana, bob } = await twoUsers();
    await saveSharedPlaylist(ctx, {
      id: 'PLdeclined',
      title: 'Nope',
      inviteToken: 'token',
      ownerId: ana.userId,
      friendId: bob.userId,
    });

    expect((await bob.client.request('DELETE', '/social/playlists/PLdeclined/invite')).status).toBe(
      204,
    );
    expect((await overview(bob.client)).invites).toEqual([]);
  });
});
