import { blob, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) => integer(name, { mode: 'number' });

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  language: text('language').notNull(),
  // Bumped on every upload so the avatar URL changes and caches refresh.
  avatarVersion: integer('avatar_version'),
  emailVerifiedAt: timestamp('email_verified_at'),
  isYoutubeHistoryEnabled: integer('is_youtube_history_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  isNowPlayingPublic: integer('is_now_playing_public', { mode: 'boolean' })
    .notNull()
    .default(false),
  isRecentSharedWithFriends: integer('is_recent_shared_with_friends', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Set by an admin: the account keeps its data but cannot sign in or use any session or token.
  suspendedAt: timestamp('suspended_at'),
  // Updated with the session (at most once a minute), for the admin panel and activity stats.
  lastActiveAt: timestamp('last_active_at'),
  createdAt: timestamp('created_at').notNull(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Only the SHA-256 of the cookie token is stored, so a leaked database cannot sign anyone in.
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent').notNull(),
    ip: text('ip').notNull(),
    createdAt: timestamp('created_at').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const emailTokens = sqliteTable(
  'email_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
  },
  (table) => [index('email_tokens_user_id_idx').on(table.userId)],
);

export const passkeys = sqliteTable(
  'passkeys',
  {
    // The WebAuthn credential ID, base64url-encoded.
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    publicKey: blob('public_key', { mode: 'buffer' }).notNull(),
    counter: integer('counter').notNull(),
    transports: text('transports', { mode: 'json' }).$type<string[]>().notNull(),
    isBackedUp: integer('is_backed_up', { mode: 'boolean' }).notNull(),
    createdAt: timestamp('created_at').notNull(),
    lastUsedAt: timestamp('last_used_at'),
  },
  (table) => [index('passkeys_user_id_idx').on(table.userId)],
);

export const googleAccounts = sqliteTable('google_accounts', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  // AES-256-GCM with SECRET_KEY; these cookies are as good as the Google password.
  cookieCiphertext: text('cookie_ciphertext').notNull(),
  method: text('method').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  photo: text('photo'),
  linkedAt: timestamp('linked_at').notNull(),
});

export const images = sqliteTable('images', {
  // First 128 bits of the URL's SHA-256, base64url: opaque, stable and safe to put in paths.
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Only the SHA-256 is stored, like session tokens.
    tokenHash: text('token_hash').notNull().unique(),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
    createdAt: timestamp('created_at').notNull(),
    lastUsedAt: timestamp('last_used_at'),
  },
  (table) => [index('api_tokens_user_id_idx').on(table.userId)],
);

// The last song each user heard, so the widget still has something to show after a restart.
export const lastPlayed = sqliteTable('last_played', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  track: text('track', { mode: 'json' }).$type<unknown>().notNull(),
  playedAt: timestamp('played_at').notNull(),
});

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  message: text('message').notNull(),
  level: text('level').notNull(),
  // Kept when the admin who wrote it is deleted; the message is the server's, not theirs.
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

// One row per pair. Until `acceptedAt` is set it is a request from `requesterId`.
export const friendships = sqliteTable(
  'friendships',
  {
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: text('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
  },
  (table) => [
    primaryKey({ columns: [table.requesterId, table.addresseeId] }),
    index('friendships_addressee_idx').on(table.addresseeId),
  ],
);

// Collaborative YT Music playlists made through Lyra. The playlist itself lives in YouTube;
// this remembers who it was made with, for profiles and invitations.
export const sharedPlaylists = sqliteTable('shared_playlists', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  // YouTube's invite token (the link's `jct`); anyone holding it can join.
  inviteToken: text('invite_token').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export const sharedPlaylistMembers = sqliteTable(
  'shared_playlist_members',
  {
    playlistId: text('playlist_id')
      .notNull()
      .references(() => sharedPlaylists.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invitedAt: timestamp('invited_at').notNull(),
    // Null while the invitation is pending.
    joinedAt: timestamp('joined_at'),
  },
  (table) => [
    primaryKey({ columns: [table.playlistId, table.userId] }),
    index('shared_playlist_members_user_idx').on(table.userId),
  ],
);

// One row per browser or installed app that accepted notifications.
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    endpoint: text('endpoint').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [index('push_subscriptions_user_idx').on(table.userId)],
);

// Settings changed from the admin panel, one JSON value per key; the env file holds the defaults.
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  // NULL is a value too: it turns an optional setting off on purpose.
  value: text('value', { mode: 'json' }).$type<unknown>(),
  updatedAt: timestamp('updated_at').notNull(),
});

// --- Statistics: totals only. Nothing here is shown per person. ---

// One row per song heard past the listen threshold. The user id stays so "how many different
// people listened" can be counted, and is cleared if the account is deleted.
export const plays = sqliteTable(
  'plays',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    videoId: text('video_id').notNull(),
    title: text('title'),
    artists: text('artists', { mode: 'json' }).$type<unknown>(),
    durationSeconds: integer('duration_seconds'),
    playedAt: timestamp('played_at').notNull(),
  },
  (table) => [index('plays_played_at_idx').on(table.playedAt)],
);

// Which accounts used the app in each hour (hours since the epoch). Hours rather than days, so
// the panel can show days in the admin's own time zone.
export const activeHours = sqliteTable(
  'active_hours',
  {
    hour: integer('hour').notNull(),
    userId: text('user_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.hour, table.userId] })],
);

// How many times each event happened in each hour.
export const eventHours = sqliteTable(
  'event_hours',
  {
    hour: integer('hour').notNull(),
    name: text('name').notNull(),
    count: integer('count').notNull(),
  },
  (table) => [primaryKey({ columns: [table.hour, table.name] })],
);
