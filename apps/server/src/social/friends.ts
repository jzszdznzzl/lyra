import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';

import { FriendStatus } from '@lyra/shared';
import type { FriendsOverview, PlaylistInvite, SharedPlaylist, UserCard } from '@lyra/shared';

import { schema } from '../db/index.ts';
import type { User } from '../auth/sessions.ts';
import type { AppContext } from '../context.ts';

type Friendship = typeof schema.friendships.$inferSelect;

function between(firstId: string, secondId: string) {
  return or(
    and(eq(schema.friendships.requesterId, firstId), eq(schema.friendships.addresseeId, secondId)),
    and(eq(schema.friendships.requesterId, secondId), eq(schema.friendships.addresseeId, firstId)),
  );
}

function statusOf(row: Friendship | undefined, meId: string): FriendStatus {
  if (!row) {
    return FriendStatus.None;
  }

  if (row.acceptedAt !== null) {
    return FriendStatus.Friends;
  }

  return row.requesterId === meId ? FriendStatus.Outgoing : FriendStatus.Incoming;
}

async function cardsById(ctx: AppContext, ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, UserCard>();
  }

  const rows = await ctx.db.select().from(schema.users).where(inArray(schema.users.id, ids));

  return new Map(rows.map((user) => [user.id, toUserCard(user)]));
}

async function playlistsOf(ctx: AppContext, playlistIds: string[]): Promise<SharedPlaylist[]> {
  if (playlistIds.length === 0) {
    return [];
  }

  const playlists = await ctx.db
    .select()
    .from(schema.sharedPlaylists)
    .where(inArray(schema.sharedPlaylists.id, playlistIds));
  const members = await ctx.db
    .select()
    .from(schema.sharedPlaylistMembers)
    .where(inArray(schema.sharedPlaylistMembers.playlistId, playlistIds));
  const cards = await cardsById(ctx, [
    ...new Set([...playlists.map((p) => p.ownerId), ...members.map((m) => m.userId)]),
  ]);

  return playlists.flatMap((playlist) => {
    const owner = cards.get(playlist.ownerId);

    if (!owner) {
      return [];
    }

    return [
      {
        id: playlist.id,
        title: playlist.title,
        owner,
        members: members
          .filter((member) => member.playlistId === playlist.id && member.joinedAt !== null)
          .flatMap((member) => cards.get(member.userId) ?? []),
      },
    ];
  });
}

/** Public listening is visible to anyone, so friends see it too. */
export function sharesListeningWithFriends(user: User) {
  return user.isNowPlayingSharedWithFriends || user.isNowPlayingPublic;
}

export function toUserCard(user: User): UserCard {
  return {
    username: user.username,
    name: user.name,
    avatarUrl:
      user.avatarVersion === null ? null : `/api/avatars/${user.id}.webp?v=${user.avatarVersion}`,
  };
}

/** Suspended accounts are hidden, as if they did not exist. */
export async function findUser(ctx: AppContext, username: string) {
  const [user] = await ctx.db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.username, username), isNull(schema.users.suspendedAt)));

  return user ?? null;
}

export async function friendStatus(ctx: AppContext, meId: string, otherId: string) {
  if (meId === otherId) {
    return FriendStatus.Self;
  }

  const [row] = await ctx.db.select().from(schema.friendships).where(between(meId, otherId));

  return statusOf(row, meId);
}

/** Sends a request, or accepts the one the other person already sent. */
export async function requestFriend(ctx: AppContext, meId: string, otherId: string) {
  const [row] = await ctx.db.select().from(schema.friendships).where(between(meId, otherId));
  const status = statusOf(row, meId);

  if (status === FriendStatus.Incoming) {
    await ctx.db
      .update(schema.friendships)
      .set({ acceptedAt: ctx.now() })
      .where(between(meId, otherId));

    return FriendStatus.Friends;
  }

  if (status === FriendStatus.None) {
    await ctx.db
      .insert(schema.friendships)
      .values({ requesterId: meId, addresseeId: otherId, createdAt: ctx.now() });

    return FriendStatus.Outgoing;
  }

  return status;
}

/** Unfriends, cancels a sent request or declines a received one. */
export async function removeFriend(ctx: AppContext, meId: string, otherId: string) {
  await ctx.db.delete(schema.friendships).where(between(meId, otherId));
}

/** Playlists both people have joined (the owner counts as joined). */
export async function sharedBetween(ctx: AppContext, meId: string, otherId: string) {
  const rows = await ctx.db
    .select()
    .from(schema.sharedPlaylistMembers)
    .where(
      and(
        inArray(schema.sharedPlaylistMembers.userId, [meId, otherId]),
        isNotNull(schema.sharedPlaylistMembers.joinedAt),
      ),
    );
  const mine = new Set(rows.filter((row) => row.userId === meId).map((row) => row.playlistId));
  const both = rows
    .filter((row) => row.userId === otherId && mine.has(row.playlistId))
    .map((row) => row.playlistId);

  return playlistsOf(ctx, [...new Set(both)]);
}

export async function friendsOverview(ctx: AppContext, meId: string): Promise<FriendsOverview> {
  const rows = await ctx.db
    .select()
    .from(schema.friendships)
    .where(or(eq(schema.friendships.requesterId, meId), eq(schema.friendships.addresseeId, meId)));
  const pending = await ctx.db
    .select()
    .from(schema.sharedPlaylistMembers)
    .where(
      and(
        eq(schema.sharedPlaylistMembers.userId, meId),
        isNull(schema.sharedPlaylistMembers.joinedAt),
      ),
    );
  const playlists =
    pending.length === 0
      ? []
      : await ctx.db
          .select()
          .from(schema.sharedPlaylists)
          .where(
            inArray(
              schema.sharedPlaylists.id,
              pending.map((row) => row.playlistId),
            ),
          );
  const otherIds = rows.map((row) =>
    row.requesterId === meId ? row.addresseeId : row.requesterId,
  );
  const cards = await cardsById(ctx, [
    ...new Set([...otherIds, ...playlists.map((p) => p.ownerId)]),
  ]);
  const pick = (status: FriendStatus) =>
    rows
      .filter((row) => statusOf(row, meId) === status)
      .flatMap(
        (row) => cards.get(row.requesterId === meId ? row.addresseeId : row.requesterId) ?? [],
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  const invites = playlists.flatMap((playlist): PlaylistInvite[] => {
    const from = cards.get(playlist.ownerId);
    const row = pending.find((member) => member.playlistId === playlist.id);

    return from && row
      ? [{ playlistId: playlist.id, title: playlist.title, from, createdAt: row.invitedAt }]
      : [];
  });

  return {
    friends: pick(FriendStatus.Friends),
    incoming: pick(FriendStatus.Incoming),
    outgoing: pick(FriendStatus.Outgoing),
    invites,
  };
}

export async function saveSharedPlaylist(
  ctx: AppContext,
  input: { id: string; title: string; inviteToken: string; ownerId: string; friendId: string },
) {
  const now = ctx.now();

  await ctx.db.insert(schema.sharedPlaylists).values({
    id: input.id,
    ownerId: input.ownerId,
    title: input.title,
    inviteToken: input.inviteToken,
    createdAt: now,
  });
  await ctx.db.insert(schema.sharedPlaylistMembers).values([
    { playlistId: input.id, userId: input.ownerId, invitedAt: now, joinedAt: now },
    { playlistId: input.id, userId: input.friendId, invitedAt: now, joinedAt: null },
  ]);
}

/** The pending invitation of this user, with the token needed to join. */
export async function pendingInvite(ctx: AppContext, meId: string, playlistId: string) {
  const [row] = await ctx.db
    .select({ inviteToken: schema.sharedPlaylists.inviteToken })
    .from(schema.sharedPlaylistMembers)
    .innerJoin(
      schema.sharedPlaylists,
      eq(schema.sharedPlaylists.id, schema.sharedPlaylistMembers.playlistId),
    )
    .where(
      and(
        eq(schema.sharedPlaylistMembers.playlistId, playlistId),
        eq(schema.sharedPlaylistMembers.userId, meId),
        isNull(schema.sharedPlaylistMembers.joinedAt),
      ),
    );

  return row ?? null;
}

export async function markJoined(ctx: AppContext, meId: string, playlistId: string) {
  await ctx.db
    .update(schema.sharedPlaylistMembers)
    .set({ joinedAt: ctx.now() })
    .where(
      and(
        eq(schema.sharedPlaylistMembers.playlistId, playlistId),
        eq(schema.sharedPlaylistMembers.userId, meId),
      ),
    );
}

export async function declineInvite(ctx: AppContext, meId: string, playlistId: string) {
  await ctx.db
    .delete(schema.sharedPlaylistMembers)
    .where(
      and(
        eq(schema.sharedPlaylistMembers.playlistId, playlistId),
        eq(schema.sharedPlaylistMembers.userId, meId),
        isNull(schema.sharedPlaylistMembers.joinedAt),
      ),
    );
}

/** Friends who let their friends see what they play. Suspended accounts are left out. */
export async function friendsSharingListening(ctx: AppContext, meId: string) {
  const rows = await ctx.db
    .select()
    .from(schema.friendships)
    .where(
      and(
        or(eq(schema.friendships.requesterId, meId), eq(schema.friendships.addresseeId, meId)),
        isNotNull(schema.friendships.acceptedAt),
      ),
    );
  const ids = rows.map((row) => (row.requesterId === meId ? row.addresseeId : row.requesterId));

  if (ids.length === 0) {
    return [];
  }

  const users = await ctx.db
    .select()
    .from(schema.users)
    .where(and(inArray(schema.users.id, ids), isNull(schema.users.suspendedAt)));

  return users.filter(sharesListeningWithFriends);
}
