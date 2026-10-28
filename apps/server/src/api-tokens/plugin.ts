import { Elysia } from 'elysia';

import { AuthError } from '@lyra/shared';
import type { TokenScope } from '@lyra/shared';

import { RateLimiter } from '../common/index.ts';
import { findApiTokenUser } from './tokens.ts';
import type { AppContext } from '../context.ts';

const BEARER = /^Bearer\s+(\S+)$/i;
const MINUTE_MS = 60 * 1000;
// Plenty for a client polling every second; the event stream needs no polling at all.
const REQUESTS_PER_MINUTE = 120;

/**
 * Adds the `apiScope` route option: the request must carry `Authorization: Bearer <token>` with
 * that scope. Resolves `user`, or answers 401. Cookies are ignored, so these routes cannot be
 * reached from another site with the user's session.
 */
export function apiTokenPlugin(ctx: AppContext) {
  const limiter = new RateLimiter(REQUESTS_PER_MINUTE, MINUTE_MS, ctx.now);

  return new Elysia({ name: 'api-token-plugin' }).macro({
    apiScope: (scope: TokenScope) => ({
      async resolve({ headers, status }) {
        const token = BEARER.exec(headers['authorization'] ?? '')?.[1];
        const found = token ? await findApiTokenUser(ctx, token, scope) : null;

        if (!found) {
          return status(401, { error: AuthError.Unauthorized });
        }

        if (!limiter.hit(found.tokenId)) {
          return status(429, { error: AuthError.TooManyRequests });
        }

        return { user: found.user };
      },
    }),
  });
}
