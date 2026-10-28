import { eq } from 'drizzle-orm';

import { DEFAULT_LANGUAGE, Language } from '@lyra/shared';

import { schema } from '../db/index.ts';
import { getGoogleCookie } from '../google/accounts.ts';
import type { User } from '../auth/sessions.ts';
import type { AppContext } from '../context.ts';
import type { InnertubePool } from './innertube.ts';

function languageOf(user: User) {
  return Object.values(Language).find((value) => value === user.language) ?? DEFAULT_LANGUAGE;
}

/** The user's own YT Music session when linked, an anonymous one otherwise. */
export async function musicClient(ctx: AppContext, pool: InnertubePool, user: User) {
  const cookie = await getGoogleCookie(ctx, user.id);

  return pool.get({ userId: cookie ? user.id : null, cookie, language: languageOf(user) });
}

/** Only for data that needs the account (library, likes); null when Google is not linked. */
export async function accountClient(ctx: AppContext, pool: InnertubePool, user: User) {
  const cookie = await getGoogleCookie(ctx, user.id);

  return cookie ? pool.get({ userId: user.id, cookie, language: languageOf(user) }) : null;
}

/**
 * The client of the fallback account (panel setting, or STREAM_FALLBACK_USERNAME), which plays songs for users without
 * their own; null when unset, unknown or not linked.
 */
export async function fallbackClient(ctx: AppContext, pool: InnertubePool) {
  const username = ctx.settings.current.streamFallbackUsername;

  if (!username) {
    return null;
  }

  const [row] = await ctx.db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username));
  const cookie = row ? await getGoogleCookie(ctx, row.id) : null;

  if (!row || !cookie) {
    return null;
  }

  return {
    userId: row.id,
    yt: await pool.get({ userId: row.id, cookie, language: DEFAULT_LANGUAGE }),
  };
}
