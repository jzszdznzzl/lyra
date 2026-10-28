import { Elysia } from 'elysia';
import { z } from 'zod';

import { clientInfo } from '../auth/plugin.ts';
import { RateLimiter } from '../common/index.ts';
import type { AppContext } from '../context.ts';
import type { ImageRegistry } from './registry.ts';

// Only YouTube's image CDNs, checked again here in case a bad URL ever got registered.
const ALLOWED_HOSTS = new Set([
  'lh3.googleusercontent.com',
  'yt3.googleusercontent.com',
  'yt3.ggpht.com',
  'i.ytimg.com',
  'i9.ytimg.com',
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CACHE_CONTROL = 'public, max-age=2592000, immutable';
const IMAGES_PER_MINUTE = 600;
const MINUTE_MS = 60 * 1000;

const ImageParams = z.object({ id: z.string().regex(/^[\w-]{22}$/) });

/**
 * Cover art by opaque id. Public, because link previews (WhatsApp, Telegram) fetch it without
 * a session; safe, because only ids the server issued resolve to anything.
 */
export function imageRoutes(ctx: AppContext, images: ImageRegistry) {
  const limiter = new RateLimiter(IMAGES_PER_MINUTE, MINUTE_MS, ctx.now);

  return new Elysia().get(
    '/images/:id',
    async ({ params, request, server, status }) => {
      if (!limiter.hit(clientInfo(ctx, request, server).ip)) {
        return status(429, { error: 'too_many_requests' });
      }

      const remote = await images.urlOf(params.id);

      if (!remote || !ALLOWED_HOSTS.has(new URL(remote).hostname)) {
        return status(404, { error: 'not_found' });
      }

      const upstream = await fetch(remote, { redirect: 'error' }).catch(() => null);
      const type = upstream?.headers.get('content-type') ?? '';
      const length = Number(upstream?.headers.get('content-length') ?? 0);

      if (!upstream?.ok || !type.startsWith('image/') || length > MAX_IMAGE_BYTES) {
        return status(502, { error: 'upstream' });
      }

      return new Response(upstream.body, {
        headers: { 'content-type': type, 'cache-control': CACHE_CONTROL },
      });
    },
    { params: ImageParams },
  );
}
