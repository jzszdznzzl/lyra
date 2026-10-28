import { Elysia } from 'elysia';

import { AuthError } from '@lyra/shared';

import { clientInfo } from '../auth/plugin.ts';
import { SESSION_COOKIE, findSession } from '../auth/sessions.ts';
import { isAdmin } from './admins.ts';
import type { AppContext } from '../context.ts';

/**
 * Adds the `isAdmin` route option. Anyone who is not an admin, signed in or not, gets the same
 * 404 as a route that does not exist, so the panel cannot be discovered by probing.
 *
 * Do not give these routes `params`, `query` or `body` schemas: Elysia validates them before
 * this check, and a 422 would tell a stranger the route is real. Parse inside the handler.
 */
export function adminPlugin(ctx: AppContext) {
  return new Elysia({ name: 'admin-plugin' }).macro({
    isAdmin: {
      async resolve({ cookie, request, server, status }) {
        const token = cookie[SESSION_COOKIE]?.value;
        const found =
          typeof token === 'string' && token !== ''
            ? await findSession(ctx, token, clientInfo(ctx, request, server))
            : null;

        if (!found || !isAdmin(ctx, found.user)) {
          return status(404, { error: AuthError.NotFound });
        }

        return { user: found.user, session: found.session };
      },
    },
  });
}
