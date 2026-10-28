import { Elysia } from 'elysia';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import {
  AuthError,
  DEFAULT_LANGUAGE,
  Language,
  StatEvent,
  TokenScope,
  USERNAME_PATTERN,
} from '@lyra/shared';
import type { NowPlaying } from '@lyra/shared';

import { apiTokenPlugin } from '../api-tokens/plugin.ts';
import { clientInfo } from '../auth/plugin.ts';
import { RateLimiter } from '../common/index.ts';
import { schema } from '../db/index.ts';
import { countEvent } from '../stats/recorder.ts';
import { INVALID_QUERY, parseQuery } from '../query.ts';
import { WidgetTheme, renderWidget } from './widget.ts';
import type { AppContext } from '../context.ts';
import type { NowPlayingService } from './now-playing.ts';
import type { WidgetCovers } from './widget-covers.ts';

const UsernameParams = z.object({ username: z.string().regex(USERNAME_PATTERN) });
const WidgetQuery = z.object({ theme: z.enum(WidgetTheme).default(WidgetTheme.Dark) });

const MINUTE_MS = 60 * 1000;
// Widgets sit on public pages; a generous budget per visitor still stops scraping loops.
const PUBLIC_REQUESTS_PER_MINUTE = 60;
// Cloudflare drops a response that sends nothing for 100 seconds.
const HEARTBEAT_MS = 25_000;
// Readable from any website: these answers never depend on cookies, only on the token.
const CORS = { 'access-control-allow-origin': '*' };
const PREFLIGHT = {
  ...CORS,
  'access-control-allow-headers': 'authorization',
  'access-control-allow-methods': 'GET',
  'access-control-max-age': '86400',
};
// Image proxies (GitHub's camo) honour this, so the card refreshes instead of freezing.
const NO_STORE = 'no-cache, no-store, max-age=0, must-revalidate';
// The SVG may be opened directly; nothing in it should ever run.
const SVG_POLICY = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";

const encoder = new TextEncoder();

function event(nowPlaying: NowPlaying | null) {
  return encoder.encode(`event: now-playing\ndata: ${JSON.stringify(nowPlaying)}\n\n`);
}

/**
 * What a user is listening to: for their personal tokens (Discord presence, scripts) and, when
 * they opt in, for anyone through the public widget.
 */
export function nowPlayingRoutes(
  ctx: AppContext,
  service: NowPlayingService,
  covers: WidgetCovers,
) {
  const limiter = new RateLimiter(PUBLIC_REQUESTS_PER_MINUTE, MINUTE_MS, ctx.now);

  async function publicNowPlaying(username: string) {
    const [user] = await ctx.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.username, username),
          eq(schema.users.isNowPlayingPublic, true),
          isNull(schema.users.suspendedAt),
        ),
      );

    if (!user) {
      return null;
    }

    const nowPlaying = await service.current(user.id);

    // Device names often carry the owner's name ("Ana's iPhone"); the public card leaves them out.
    return { user, nowPlaying: nowPlaying ? { ...nowPlaying, device: null } : null };
  }

  return new Elysia()
    .use(apiTokenPlugin(ctx))
    .options('/me/now-playing', ({ set, status }) => {
      Object.assign(set.headers, PREFLIGHT);

      return status(204);
    })
    .options('/me/now-playing/events', ({ set, status }) => {
      Object.assign(set.headers, PREFLIGHT);

      return status(204);
    })
    .get(
      '/me/now-playing',
      async ({ user, set, status }) => {
        Object.assign(set.headers, CORS, { 'cache-control': NO_STORE });
        countEvent(ctx, StatEvent.ApiRequest);
        const nowPlaying = await service.current(user.id);

        return nowPlaying ?? status(204);
      },
      { apiScope: TokenScope.NowPlayingRead },
    )
    .get(
      '/me/now-playing/events',
      ({ user, request, server }) => {
        let stop = () => {};
        const stream = new ReadableStream<Uint8Array>({
          start: async (controller) => {
            const send = (chunk: Uint8Array) => {
              try {
                controller.enqueue(chunk);
              } catch {
                stop();
              }
            };
            const unsubscribe = service.subscribe(user.id, (nowPlaying) => send(event(nowPlaying)));

            if (!unsubscribe) {
              controller.close();

              return;
            }

            const heartbeat = setInterval(
              () => send(encoder.encode(': keep-alive\n\n')),
              HEARTBEAT_MS,
            );
            stop = () => {
              clearInterval(heartbeat);
              unsubscribe();
            };
            request.signal.addEventListener('abort', () => stop());
            send(event(await service.current(user.id)));
          },
          cancel: () => stop(),
        });

        countEvent(ctx, StatEvent.ApiRequest);
        // Bun closes connections that stay quiet for a few seconds; this one waits on purpose.
        server?.timeout(request, 0);

        return new Response(stream, {
          headers: {
            ...CORS,
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            'x-accel-buffering': 'no',
          },
        });
      },
      { apiScope: TokenScope.NowPlayingRead },
    )
    .get(
      '/u/:username/now-playing.json',
      async ({ params, request, server, set, status }) => {
        if (!limiter.hit(clientInfo(ctx, request, server).ip)) {
          return status(429, { error: AuthError.TooManyRequests });
        }

        const found = await publicNowPlaying(params.username);

        if (!found) {
          return status(404, { error: AuthError.NotFound });
        }

        Object.assign(set.headers, CORS, { 'cache-control': NO_STORE });

        return found.nowPlaying ?? status(204);
      },
      { params: UsernameParams },
    )
    .get(
      '/u/:username/now-playing.svg',
      async ({ params, query: raw, request, server, status }) => {
        const query = parseQuery(WidgetQuery, raw);

        if (!query) {
          return status(422, INVALID_QUERY);
        }

        if (!limiter.hit(clientInfo(ctx, request, server).ip)) {
          return status(429, { error: AuthError.TooManyRequests });
        }

        const found = await publicNowPlaying(params.username);

        if (!found) {
          return status(404, { error: AuthError.NotFound });
        }

        countEvent(ctx, StatEvent.WidgetView);
        const svg = renderWidget({
          nowPlaying: found.nowPlaying,
          cover: await covers.dataUri(found.nowPlaying?.track.coverUrl ?? null),
          language:
            Object.values(Language).find((language) => language === found.user.language) ??
            DEFAULT_LANGUAGE,
          theme: query.theme,
          now: ctx.now(),
        });

        return new Response(svg, {
          headers: {
            ...CORS,
            'content-type': 'image/svg+xml; charset=utf-8',
            'cache-control': NO_STORE,
            'content-security-policy': SVG_POLICY,
          },
        });
      },
      { params: UsernameParams },
    );
}
