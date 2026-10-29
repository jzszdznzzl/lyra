import { Elysia } from 'elysia';

import { RecapQuery } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { INVALID_QUERY, parseQuery } from '../query.ts';
import { sessionRateLimit } from '../security.ts';
import { recapFor } from './recap.ts';
import type { ImageRegistry } from '../images/registry.ts';
import type { AppContext } from '../context.ts';

/** Each person's year in Lyra, only ever for themselves. */
export function recapRoutes(ctx: AppContext, images: ImageRegistry) {
  return (
    new Elysia({ prefix: '/me' })
      .use(authPlugin(ctx))
      .use(sessionRateLimit(ctx, 'recap', 30))
      // Covers come from YouTube; they go through Lyra's image proxy like every other cover.
      .onAfterHandle(async ({ responseValue }) => {
        await images.rewrite(responseValue);
      })
      .get(
        '/recap',
        async ({ user, query: raw, status }) => {
          const query = parseQuery(RecapQuery, raw);

          if (!query) {
            return status(422, INVALID_QUERY);
          }

          return recapFor(ctx, user.id, query.year, query.offset);
        },
        { isSignedIn: true },
      )
  );
}
