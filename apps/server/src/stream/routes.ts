import { Elysia } from 'elysia';
import { z } from 'zod';

import { LOUDNESS_HEADER, MusicError, StatEvent, StreamQuery, StreamType } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { sessionRateLimit } from '../security.ts';
import { countEvent } from '../stats/recorder.ts';
import { INVALID_QUERY, parseQuery } from '../query.ts';
import { fallbackClient, musicClient } from '../ytmusic/clients.ts';
import { PoTokenMinter } from '../ytmusic/po-token.ts';
import { chunkedBody, parseRange } from './ranges.ts';
import { StreamResolver } from './resolver.ts';
import { FALLBACK_CACHE_KEY, StreamAccounts } from './stream-accounts.ts';
import type { StreamSelection } from './resolver.ts';
import type { AppContext } from '../context.ts';
import type { InnertubePool } from '../ytmusic/innertube.ts';

const VideoParams = z.object({ id: z.string().regex(/^[\w-]{11}$/) });
const HTTP_FORBIDDEN = 403;
// The web app asks for a single byte to learn why a song failed; that is not a song starting.
const DIAGNOSIS_RANGE = 'bytes=0-0';
const FROM_START = /^bytes=0-/;
const GOOGLE_ERRORS: readonly MusicError[] = [
  MusicError.GoogleNotLinked,
  MusicError.GoogleSessionExpired,
];
const ERROR_STATUS: Partial<Record<MusicError, number>> = {
  [MusicError.Unavailable]: 404,
  [MusicError.GoogleNotLinked]: 403,
  [MusicError.GoogleSessionExpired]: 403,
};

/**
 * Proxies YouTube audio. googlevideo URLs only work from the IP that deciphered them, and they
 * send no CORS headers, which Web Audio (equalizer, crossfade) needs.
 */
export function streamRoutes(ctx: AppContext, pool: InnertubePool) {
  const resolver = new StreamResolver(ctx.now, new PoTokenMinter(ctx.now));
  const accounts = new StreamAccounts(
    ctx.now,
    async () => (await fallbackClient(ctx, pool))?.yt ?? null,
  );

  return new Elysia({ prefix: '/stream' })
    .use(authPlugin(ctx))
    .use(sessionRateLimit(ctx, 'stream', 300))
    .get(
      '/:id',
      async ({ params, query: raw, request, user, status }) => {
        const query = parseQuery(StreamQuery, raw);

        if (!query) {
          return status(422, INVALID_QUERY);
        }

        const selection: StreamSelection =
          query.type === StreamType.Audio
            ? {
                type: StreamType.Audio,
                quality: query.quality,
                ...(query.container ? { container: query.container } : {}),
              }
            : { type: StreamType.Video, height: query.height };
        const rangeHeader = request.headers.get('range');
        // Players fetch a song in many ranges; only the first request of an audio stream counts.
        const isSongStart =
          query.type === StreamType.Audio &&
          rangeHeader !== DIAGNOSIS_RANGE &&
          (rangeHeader === null || FROM_START.test(rangeHeader));
        const count = (event: StatEvent) => {
          if (isSongStart) {
            countEvent(ctx, event);
          }
        };
        const yt = await musicClient(ctx, pool, user);
        const own = { yt, cacheKey: user.id, isSignedIn: yt.session.logged_in };
        // One retry: a cached URL can be revoked early, which googlevideo answers with 403.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const resolved = await accounts.resolve(own, (client) =>
            resolver.resolve(client.yt, client.cacheKey, params.id, selection),
          );

          if (resolved.error) {
            count(
              GOOGLE_ERRORS.includes(resolved.error)
                ? StatEvent.StreamGoogleRequired
                : StatEvent.StreamError,
            );

            return status(ERROR_STATUS[resolved.error] ?? 502, { error: resolved.error });
          }

          const { client, stream } = resolved.data;
          const { url, itag, contentLength, mimeType, loudnessDb } = stream;
          const range = parseRange(request.headers.get('range'), contentLength);

          if (!range) {
            return new Response(null, {
              status: 416,
              headers: { 'content-range': `bytes */${contentLength}` },
            });
          }

          // Probing the first piece catches revoked URLs before any byte reaches the player.
          const probe = await fetch(url, {
            headers: { range: 'bytes=0-0' },
            signal: request.signal,
          }).catch(() => null);

          if (probe?.status === HTTP_FORBIDDEN) {
            resolver.forget(client.cacheKey, params.id, selection);
            continue;
          }

          const headers = new Headers({
            'content-type': mimeType.split(';')[0] ?? mimeType,
            'content-length': String(range.end - range.start + 1),
            'accept-ranges': 'bytes',
            'cache-control': 'private, no-store',
          });

          if (request.headers.has('range')) {
            headers.set('content-range', `bytes ${range.start}-${range.end}/${contentLength}`);
          }

          if (loudnessDb !== null) {
            headers.set(LOUDNESS_HEADER, String(loudnessDb));
          }

          // A URL revoked mid-song gets a fresh one; it must be the same file for bytes to line up.
          const refreshUrl = async () => {
            resolver.forget(client.cacheKey, params.id, selection);
            const fresh = await resolver.resolve(client.yt, client.cacheKey, params.id, selection);

            return fresh.data?.itag === itag && fresh.data.contentLength === contentLength
              ? fresh.data.url
              : null;
          };

          if (client.cacheKey === FALLBACK_CACHE_KEY) {
            count(StatEvent.StreamFallback);
          } else {
            count(client.isSignedIn ? StatEvent.StreamOwn : StatEvent.StreamAnonymous);
          }

          return new Response(chunkedBody(url, range, request.signal, fetch, refreshUrl), {
            status: request.headers.has('range') ? 206 : 200,
            headers,
          });
        }

        count(StatEvent.StreamError);

        return status(502, { error: MusicError.Upstream });
      },
      { isSignedIn: true, params: VideoParams },
    );
}
