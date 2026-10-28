import { blob, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
