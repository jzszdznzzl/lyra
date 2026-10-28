import { DEFAULT_LANGUAGE, Language } from '@lyra/shared';

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
