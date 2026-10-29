import { Elysia } from 'elysia';
import { z } from 'zod';

import { CreateSharedPlaylistInput, FriendStatus, SocialError } from '@lyra/shared';
import type { PlaylistCard, Track, UserMusic, UserPage } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { PushKind } from '../push/messages.ts';
import { isGoogleLinked } from '../google/accounts.ts';
import { sessionRateLimit } from '../security.ts';
import { getHistory, getPublicPlaylists } from '../ytmusic/catalog.ts';
import { accountClient } from '../ytmusic/clients.ts';
import { createCollaborativePlaylist, joinCollaboration } from '../ytmusic/library.ts';
import {
  declineInvite,
  findUser,
  friendStatus,
  friendsOverview,
  markJoined,
  pendingInvite,
  removeFriend,
  requestFriend,
  saveSharedPlaylist,
  sharedBetween,
  toUserCard,
} from './friends.ts';
import type { ImageRegistry } from '../images/registry.ts';
import type { NowPlayingService } from '../now-playing/now-playing.ts';
import type { PushService } from '../push/push.ts';
import type { InnertubePool } from '../ytmusic/innertube.ts';
import type { AppContext } from '../context.ts';

interface CachedPlaylists {
  playlists: PlaylistCard[];
  at: number;
}

const UsernameParams = z.object({ username: z.string().min(1).max(64) });
const PlaylistParams = z.object({ id: z.string().regex(/^[\w-]{2,64}$/) });

const SOCIAL_ERROR_STATUS = {
  [SocialError.NotFound]: 404,
  [SocialError.NotFriends]: 403,
  [SocialError.Self]: 422,
  [SocialError.GoogleNotLinked]: 409,
  [SocialError.FriendNotLinked]: 409,
  [SocialError.NeedsChannel]: 409,
  [SocialError.Upstream]: 502,
} as const satisfies Record<SocialError, number>;
// Reading which playlists are public costs a request per playlist.
const PUBLIC_PLAYLISTS_TTL_MS = 10 * 60 * 1000;
const RECENT_TRACKS = 12;

/** Friends, profiles and collaborative playlists made with friends. */
export function socialRoutes(
  ctx: AppContext,
  pool: InnertubePool,
  images: ImageRegistry,
  nowPlaying: NowPlayingService,
  push: PushService,
) {
  const publicPlaylists = new Map<string, CachedPlaylists>();

  async function cachedPublicPlaylists(userId: string, load: () => Promise<PlaylistCard[]>) {
    const cached = publicPlaylists.get(userId);

    if (cached && ctx.now() - cached.at < PUBLIC_PLAYLISTS_TTL_MS) {
      return cached.playlists;
    }

    const playlists = await load();
    publicPlaylists.set(userId, { playlists, at: ctx.now() });

    return playlists;
  }

  return (
    new Elysia({ prefix: '/social' })
      .use(authPlugin(ctx))
      .use(sessionRateLimit(ctx, 'social', 120))
      // Covers and avatars from YouTube go through Lyra's image proxy, like the rest of the music.
      .onAfterHandle(async ({ responseValue }) => {
        await images.rewrite(responseValue);
      })
      .get('/friends', ({ user }) => friendsOverview(ctx, user.id), { isSignedIn: true })
      .get(
        '/users/:username',
        async ({ user, params, status }) => {
          const other = await findUser(ctx, params.username);

          if (!other) {
            return status(404, { error: SocialError.NotFound });
          }

          const relation = await friendStatus(ctx, user.id, other.id);
          const isFriend = relation === FriendStatus.Friends;
          // People see their own page as their friends do.
          const canSee = isFriend || relation === FriendStatus.Self;
          const current =
            canSee && other.isNowPlayingPublic ? await nowPlaying.current(other.id) : null;

          return {
            user: toUserCard(other),
            status: relation,
            isGoogleLinked: await isGoogleLinked(ctx, other.id),
            // The device name often carries the owner's name; friends do not need it.
            nowPlaying: current ? { ...current, device: null } : null,
            sharedPlaylists: isFriend ? await sharedBetween(ctx, user.id, other.id) : [],
          } satisfies UserPage;
        },
        { isSignedIn: true, params: UsernameParams },
      )
      .get(
        '/users/:username/music',
        async ({ user, params, status }) => {
          const other = await findUser(ctx, params.username);

          if (!other) {
            return status(404, { error: SocialError.NotFound });
          }

          const relation = await friendStatus(ctx, user.id, other.id);

          if (relation !== FriendStatus.Friends && relation !== FriendStatus.Self) {
            return status(403, { error: SocialError.NotFriends });
          }

          const yt = await accountClient(ctx, pool, other);

          if (!yt) {
            return {
              recent: other.isRecentSharedWithFriends ? [] : null,
              publicPlaylists: [],
            } satisfies UserMusic;
          }

          const [history, playlists] = await Promise.all([
            other.isRecentSharedWithFriends ? getHistory(yt) : null,
            cachedPublicPlaylists(other.id, async () => (await getPublicPlaylists(yt)).data ?? []),
          ]);
          const recent: Track[] | null = history
            ? (history.data?.sections.flatMap((section) => section.tracks) ?? []).slice(
                0,
                RECENT_TRACKS,
              )
            : null;

          return { recent, publicPlaylists: playlists } satisfies UserMusic;
        },
        { isSignedIn: true, params: UsernameParams },
      )
      .post(
        '/friends/:username',
        async ({ user, params, status }) => {
          const other = await findUser(ctx, params.username);

          if (!other) {
            return status(404, { error: SocialError.NotFound });
          }

          if (other.id === user.id) {
            return status(422, { error: SocialError.Self });
          }

          const before = await friendStatus(ctx, user.id, other.id);
          const result = await requestFriend(ctx, user.id, other.id);
          const notice = { name: user.name, username: user.username };

          // Only real changes notify; not awaited, so the answer does not wait for push services.
          if (before === FriendStatus.None && result === FriendStatus.Outgoing) {
            void push.notify(other.id, { kind: PushKind.FriendRequest, ...notice });
          } else if (before === FriendStatus.Incoming && result === FriendStatus.Friends) {
            void push.notify(other.id, { kind: PushKind.FriendAccepted, ...notice });
          }

          return { status: result };
        },
        { isSignedIn: true, params: UsernameParams },
      )
      .delete(
        '/friends/:username',
        async ({ user, params, status }) => {
          const other = await findUser(ctx, params.username);

          if (!other) {
            return status(404, { error: SocialError.NotFound });
          }

          await removeFriend(ctx, user.id, other.id);

          return status(204);
        },
        { isSignedIn: true, params: UsernameParams },
      )
      .post(
        '/playlists',
        async ({ user, body, status }) => {
          const friend = await findUser(ctx, body.username);

          if (!friend || (await friendStatus(ctx, user.id, friend.id)) !== FriendStatus.Friends) {
            return status(403, { error: SocialError.NotFriends });
          }

          if (!(await isGoogleLinked(ctx, friend.id))) {
            return status(409, { error: SocialError.FriendNotLinked });
          }

          const yt = await accountClient(ctx, pool, user);

          if (!yt) {
            return status(409, { error: SocialError.GoogleNotLinked });
          }

          const created = await createCollaborativePlaylist(yt, body.title);

          if (created.error) {
            return status(SOCIAL_ERROR_STATUS[SocialError.Upstream], {
              error: SocialError.Upstream,
            });
          }

          await saveSharedPlaylist(ctx, {
            id: created.data.id,
            title: body.title,
            inviteToken: created.data.inviteToken,
            ownerId: user.id,
            friendId: friend.id,
          });

          void push.notify(friend.id, {
            kind: PushKind.PlaylistInvite,
            name: user.name,
            title: body.title,
          });

          return status(201, { id: created.data.id });
        },
        { isSignedIn: true, body: CreateSharedPlaylistInput },
      )
      .post(
        '/playlists/:id/join',
        async ({ user, params, status }) => {
          const invite = await pendingInvite(ctx, user.id, params.id);

          if (!invite) {
            return status(404, { error: SocialError.NotFound });
          }

          const yt = await accountClient(ctx, pool, user);

          if (!yt) {
            return status(409, { error: SocialError.GoogleNotLinked });
          }

          const joined = await joinCollaboration(yt, params.id, invite.inviteToken);

          // YouTube refuses accounts without a channel; that is by far the usual reason.
          if (joined.error) {
            return status(409, { error: SocialError.NeedsChannel });
          }

          await markJoined(ctx, user.id, params.id);

          return status(204);
        },
        { isSignedIn: true, params: PlaylistParams },
      )
      .delete(
        '/playlists/:id/invite',
        async ({ user, params, status }) => {
          await declineInvite(ctx, user.id, params.id);

          return status(204);
        },
        { isSignedIn: true, params: PlaylistParams },
      )
  );
}
