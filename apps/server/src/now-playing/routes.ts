import { Elysia } from 'elysia';

import { TokenScope } from '@lyra/shared';
import type { NowPlaying } from '@lyra/shared';

import { apiTokenPlugin } from '../api-tokens/plugin.ts';
import type { AppContext } from '../context.ts';
import type { NowPlayingService } from './now-playing.ts';

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
// Every answer is live; nothing in between should keep an old one.
const NO_STORE = 'no-cache, no-store, max-age=0, must-revalidate';

const encoder = new TextEncoder();

function event(nowPlaying: NowPlaying | null) {
  return encoder.encode(`event: now-playing\ndata: ${JSON.stringify(nowPlaying)}\n\n`);
}

/** What a user is listening to, for their personal tokens (Discord presence, scripts). */
export function nowPlayingRoutes(ctx: AppContext, service: NowPlayingService) {
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
    );
}
