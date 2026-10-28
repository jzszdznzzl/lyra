import { Elysia } from 'elysia';
import { z } from 'zod';
import type { Innertube } from 'youtubei.js';

import {
  CreatePlaylistInput,
  MusicError,
  PlaylistTracksInput,
  RenamePlaylistInput,
  SearchQuery,
  VideoForQuery,
  err,
} from '@lyra/shared';
import type { Result } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { sessionRateLimit } from '../security.ts';
import { cleanTitle } from '../lyrics/lyrics.ts';
import { INVALID_QUERY, parseQuery } from '../query.ts';
import {
  getAlbum,
  getArtist,
  getExplore,
  getTrack,
  getHome,
  getLibraryPlaylists,
  getLikedSongs,
  getPlaylist,
  getSuggestions,
  search,
  findMusicVideo,
  getUpNext,
} from './catalog.ts';
import { accountClient, musicClient } from './clients.ts';
import {
  addTracks,
  createPlaylist,
  deletePlaylist,
  likeTrack,
  removeTracks,
  renamePlaylist,
  unlikeTrack,
} from './library.ts';
import type { User } from '../auth/sessions.ts';
import type { AppContext } from '../context.ts';
import type { ImageRegistry } from '../images/registry.ts';
import type { InnertubePool } from './innertube.ts';

const MUSIC_ERROR_STATUS = {
  [MusicError.NotFound]: 404,
  [MusicError.Unavailable]: 404,
  [MusicError.GoogleNotLinked]: 409,
  [MusicError.GoogleSessionExpired]: 409,
  [MusicError.Upstream]: 502,
} as const satisfies Record<MusicError, number>;

const IdParams = z.object({ id: z.string().regex(/^[\w-]{2,64}$/) });
const VideoParams = z.object({ id: z.string().regex(/^[\w-]{11}$/) });
const SuggestionQuery = z.object({ q: z.string().trim().min(1).max(200) });

export function musicRoutes(ctx: AppContext, pool: InnertubePool, images: ImageRegistry) {
  const clientFor = (user: User) => musicClient(ctx, pool, user);

  /** Library data only exists for a signed-in YT Music account. */
  async function withAccount<T>(
    user: User,
    task: (yt: Innertube) => Promise<Result<T, MusicError>>,
  ): Promise<Result<T, MusicError>> {
    const yt = await accountClient(ctx, pool, user);

    return yt ? task(yt) : err(MusicError.GoogleNotLinked);
  }

  function respond<T>(
    result: Result<T, MusicError>,
    status: (code: number, body: unknown) => unknown,
  ) {
    return result.error
      ? status(MUSIC_ERROR_STATUS[result.error], { error: result.error })
      : result.data;
  }

  return (
    new Elysia({ prefix: '/music' })
      .use(authPlugin(ctx))
      .use(sessionRateLimit(ctx, 'music', 120))
      // Cover URLs are swapped for lyra image ids before anything leaves the server.
      .onAfterHandle(async ({ responseValue }) => {
        await images.rewrite(responseValue);
      })
      .get(
        '/home',
        async ({ user, status }) => respond(await getHome(await clientFor(user)), status),
        {
          isSignedIn: true,
        },
      )
      .get(
        '/explore',
        async ({ user, status }) => respond(await getExplore(await clientFor(user)), status),
        {
          isSignedIn: true,
        },
      )
      .get(
        '/search',
        async ({ user, query: raw, status }) => {
          const query = parseQuery(SearchQuery, raw);

          return query
            ? respond(await search(await clientFor(user), query.q, query.filter), status)
            : status(422, INVALID_QUERY);
        },
        { isSignedIn: true },
      )
      .get(
        '/suggestions',
        async ({ user, query: raw, status }) => {
          const query = parseQuery(SuggestionQuery, raw);

          return query
            ? respond(await getSuggestions(await clientFor(user), query.q), status)
            : status(422, INVALID_QUERY);
        },
        { isSignedIn: true },
      )
      .get(
        '/tracks/:id',
        async ({ user, params, status }) =>
          respond(await getTrack(await clientFor(user), params.id), status),
        { isSignedIn: true, params: VideoParams },
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
        '/video-for',
        async ({ user, query: raw, status }) => {
          const query = parseQuery(VideoForQuery, raw);

          if (!query) {
            return status(422, INVALID_QUERY);
          }

          const found = await findMusicVideo(
            await clientFor(user),
            cleanTitle(query.title),
            query.artist.split(',')[0]?.trim() ?? '',
          );

          return found.error ? respond(found, status) : { track: found.data };
        },
        { isSignedIn: true },
      )
      .get(
        '/up-next/:id',
        async ({ user, params, status }) =>
          respond(await getUpNext(await clientFor(user), params.id), status),
        { isSignedIn: true, params: IdParams },
      )
      .get(
        '/liked',
        async ({ user, status }) => respond(await withAccount(user, getLikedSongs), status),
        {
          isSignedIn: true,
        },
      )
      // --- Writes: they all act on the linked YT Music account ---
      .put(
        '/likes/:id',
        async ({ user, params, status }) =>
          respond(await withAccount(user, (yt) => likeTrack(yt, params.id)), status) ?? status(204),
        { isSignedIn: true, params: VideoParams },
      )
      .delete(
        '/likes/:id',
        async ({ user, params, status }) =>
          respond(await withAccount(user, (yt) => unlikeTrack(yt, params.id)), status) ??
          status(204),
        { isSignedIn: true, params: VideoParams },
      )
      .post(
        '/playlists',
        async ({ user, body, status }) =>
          respond(await withAccount(user, (yt) => createPlaylist(yt, body)), status),
        { isSignedIn: true, body: CreatePlaylistInput },
      )
      .patch(
        '/playlists/:id',
        async ({ user, params, body, status }) =>
          respond(
            await withAccount(user, (yt) => renamePlaylist(yt, params.id, body.title)),
            status,
          ) ?? status(204),
        { isSignedIn: true, params: IdParams, body: RenamePlaylistInput },
      )
      .delete(
        '/playlists/:id',
        async ({ user, params, status }) =>
          respond(await withAccount(user, (yt) => deletePlaylist(yt, params.id)), status) ??
          status(204),
        { isSignedIn: true, params: IdParams },
      )
      .post(
        '/playlists/:id/tracks',
        async ({ user, params, body, status }) =>
          respond(
            await withAccount(user, (yt) => addTracks(yt, params.id, body.trackIds)),
            status,
          ) ?? status(204),
        { isSignedIn: true, params: IdParams, body: PlaylistTracksInput },
      )
      .delete(
        '/playlists/:id/tracks',
        async ({ user, params, body, status }) =>
          respond(
            await withAccount(user, (yt) => removeTracks(yt, params.id, body.trackIds)),
            status,
          ) ?? status(204),
        { isSignedIn: true, params: IdParams, body: PlaylistTracksInput },
      )
  );
}
