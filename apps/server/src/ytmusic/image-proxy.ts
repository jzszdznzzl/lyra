import { Elysia } from 'elysia';
import { z } from 'zod';

import { authPlugin } from '../auth/plugin.ts';
import type { AppContext } from '../context.ts';

// Only YouTube's image CDNs; anything else would turn this into an open proxy.
const ALLOWED_HOSTS = new Set([
  'lh3.googleusercontent.com',
  'yt3.googleusercontent.com',
  'yt3.ggpht.com',
  'i.ytimg.com',
  'i9.ytimg.com',
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CACHE_CONTROL = 'public, max-age=604800, immutable';

const ImageQuery = z.object({ url: z.url({ protocol: /^https$/ }) });

/** Same-origin copies of cover art, so canvases can read their colors and the app can cache them. */
export function imageProxyRoutes(ctx: AppContext) {
  return new Elysia().use(authPlugin(ctx)).get(
    '/images',
    async ({ query, status }) => {
      const url = new URL(query.url);

      if (!ALLOWED_HOSTS.has(url.hostname)) {
        return status(400, { error: 'host_not_allowed' });
      }

      const upstream = await fetch(url, { redirect: 'error' }).catch(() => null);
      const type = upstream?.headers.get('content-type') ?? '';
      const length = Number(upstream?.headers.get('content-length') ?? 0);

      if (!upstream?.ok || !type.startsWith('image/') || length > MAX_IMAGE_BYTES) {
        return status(502, { error: 'upstream' });
      }

      return new Response(upstream.body, {
        headers: { 'content-type': type, 'cache-control': CACHE_CONTROL },
      });
    },
    { isSignedIn: true, query: ImageQuery },
  );
}
