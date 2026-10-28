import { Elysia } from 'elysia';
import { z } from 'zod';
import type { Innertube } from 'youtubei.js';

import { DEFAULT_LANGUAGE, Language, MusicError, SearchQuery, err } from '@lyra/shared';
import type { Result } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { getGoogleCookie } from '../google/accounts.ts';
import {
  getAlbum,
  getArtist,
  getHome,
  getLibraryPlaylists,
  getLikedSongs,
  getPlaylist,
  getSuggestions,
  search,
} from './catalog.ts';
import type { User } from '../auth/sessions.ts';
import type { AppContext } from '../context.ts';
import type { InnertubePool } from './innertube.ts';

const MUSIC_ERROR_STATUS = {
  [MusicError.NotFound]: 404,
  [MusicError.Unavailable]: 404,
  [MusicError.GoogleNotLinked]: 409,
  [MusicError.GoogleSessionExpired]: 409,
  [MusicError.Upstream]: 502,
} as const satisfies Record<MusicError, number>;

const IdParams = z.object({ id: z.string().regex(/^[\w-]{2,64}$/) });
const SuggestionQuery = z.object({ q: z.string().trim().min(1).max(200) });

export function musicRoutes(ctx: AppContext, pool: InnertubePool) {
  function languageOf(user: User) {
    return Object.values(Language).find((value) => value === user.language) ?? DEFAULT_LANGUAGE;
  }

  /** The user's own YT Music session when linked, an anonymous one otherwise. */
  async function clientFor(user: User) {
    const cookie = await getGoogleCookie(ctx, user.id);

    return pool.get({ userId: cookie ? user.id : null, cookie, language: languageOf(user) });
  }

  /** Library data only exists for a signed-in YT Music account. */
  async function withAccount<T>(
    user: User,
    task: (yt: Innertube) => Promise<Result<T, MusicError>>,
  ): Promise<Result<T, MusicError>> {
    const cookie = await getGoogleCookie(ctx, user.id);

    if (!cookie) {
      return err(MusicError.GoogleNotLinked);
    }

    return task(await pool.get({ userId: user.id, cookie, language: languageOf(user) }));
  }

  function respond<T>(
    result: Result<T, MusicError>,
    status: (code: number, body: unknown) => unknown,
  ) {
    return result.error
      ? status(MUSIC_ERROR_STATUS[result.error], { error: result.error })
      : result.data;
  }

  return new Elysia({ prefix: '/music' })
    .use(authPlugin(ctx))
    .get(
      '/home',
      async ({ user, status }) => respond(await getHome(await clientFor(user)), status),
      {
        isSignedIn: true,
      },
    )
    .get(
      '/search',
      async ({ user, query, status }) =>
        respond(await search(await clientFor(user), query.q, query.filter), status),
      { isSignedIn: true, query: SearchQuery },
    )
    .get(
      '/suggestions',
      async ({ user, query, status }) =>
        respond(await getSuggestions(await clientFor(user), query.q), status),
      { isSignedIn: true, query: SuggestionQuery },
    )
    .get(
      '/albums/:id',
      async ({ user, params, status }) =>
        respond(await getAlbum(await clientFor(user), params.id), status),
      { isSignedIn: true, params: IdParams },
    )
    .get(
      '/artists/:id',
      async ({ user, params, status }) =>
        respond(await getArtist(await clientFor(user), params.id), status),
      { isSignedIn: true, params: IdParams },
    )
    .get(
      '/playlists/:id',
      async ({ user, params, status }) =>
        respond(await getPlaylist(await clientFor(user), params.id), status),
      { isSignedIn: true, params: IdParams },
    )
    .get(
      '/library/playlists',
      async ({ user, status }) => respond(await withAccount(user, getLibraryPlaylists), status),
      { isSignedIn: true },
    )
    .get(
      '/liked',
      async ({ user, status }) => respond(await withAccount(user, getLikedSongs), status),
      {
        isSignedIn: true,
      },
    );
}
