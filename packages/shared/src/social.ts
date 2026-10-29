import { z } from 'zod';

import { PlaylistCard, Track } from './music.ts';
import { NowPlaying } from './now-playing.ts';

export const FriendStatus = Object.freeze({
  Self: 'self',
  None: 'none',
  // A request this user sent, waiting for the other person.
  Outgoing: 'outgoing',
  // A request the other person sent, waiting for this user.
  Incoming: 'incoming',
  Friends: 'friends',
} as const);

export type FriendStatus = (typeof FriendStatus)[keyof typeof FriendStatus];

export const SocialError = Object.freeze({
  NotFound: 'not_found',
  NotFriends: 'not_friends',
  Self: 'self',
  GoogleNotLinked: 'google_not_linked',
  FriendNotLinked: 'friend_not_linked',
  // YouTube only lets accounts with a channel join collaborative playlists.
  NeedsChannel: 'needs_channel',
  Upstream: 'upstream',
} as const);

export type SocialError = (typeof SocialError)[keyof typeof SocialError];

export const UserCard = z.object({
  username: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});

export type UserCard = z.infer<typeof UserCard>;

/** A collaborative YT Music playlist made through Lyra, with who has joined it. */
export const SharedPlaylist = z.object({
  id: z.string(),
  title: z.string(),
  owner: UserCard,
  members: z.array(UserCard),
});

export type SharedPlaylist = z.infer<typeof SharedPlaylist>;

export const PlaylistInvite = z.object({
  playlistId: z.string(),
  title: z.string(),
  from: UserCard,
  createdAt: z.number(),
});

export type PlaylistInvite = z.infer<typeof PlaylistInvite>;

export const FriendsOverview = z.object({
  friends: z.array(UserCard),
  incoming: z.array(UserCard),
  outgoing: z.array(UserCard),
  invites: z.array(PlaylistInvite),
});

export type FriendsOverview = z.infer<typeof FriendsOverview>;

/** What anyone signed in sees of a user; the music parts only reach friends. */
export const UserPage = z.object({
  user: UserCard,
  status: z.enum(FriendStatus),
  isGoogleLinked: z.boolean(),
  // Null when nothing is shared: not friends, the setting is off, or nothing was heard yet.
  nowPlaying: NowPlaying.nullable(),
  sharedPlaylists: z.array(SharedPlaylist),
});

export type UserPage = z.infer<typeof UserPage>;

/** A friend's song, playing now or heard lately, for the Friends page. */
export const FriendListening = z.object({
  user: UserCard,
  nowPlaying: NowPlaying,
});

export type FriendListening = z.infer<typeof FriendListening>;

export const FriendsListening = z.object({ friends: z.array(FriendListening) });

export type FriendsListening = z.infer<typeof FriendsListening>;

/** The slower part of a friend's page, read from their YT Music account. */
export const UserMusic = z.object({
  // Null when the friend keeps it private.
  recent: z.array(Track).nullable(),
  publicPlaylists: z.array(PlaylistCard),
});

export type UserMusic = z.infer<typeof UserMusic>;

export const CreateSharedPlaylistInput = z.object({
  title: z.string().trim().min(1).max(150),
  username: z.string().min(1).max(64),
});

export type CreateSharedPlaylistInput = z.infer<typeof CreateSharedPlaylistInput>;
