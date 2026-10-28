import { Elysia } from 'elysia';
import { z } from 'zod';

import { AuthError } from '@lyra/shared';

import { authErrorStatus } from '../http-errors.ts';
import { adminPlugin } from './plugin.ts';
import { listUsers, removeUser, setSuspended, signOutEverywhere } from './users.ts';
import type { AppContext } from '../context.ts';

export interface AdminRoutesOptions {
  // Drops what lives in memory for an account (YouTube clients, open Connect sockets).
  onAccountRemoved: (userId: string) => void;
  // Closes the account's open devices, so a suspension or sign-out applies right away.
  onSignedOut: (userId: string) => void;
}

// Checked inside the handlers, after the admin check: route-level schemas run first, and a 422
// for a stranger would reveal that the route exists.
const UserId = z.string().min(1).max(64);

export function adminRoutes(ctx: AppContext, options: AdminRoutesOptions) {
  const { onAccountRemoved, onSignedOut } = options;

  return new Elysia({ prefix: '/admin' })
    .use(adminPlugin(ctx))
    .get('/users', () => listUsers(ctx), { isAdmin: true })
    .post(
      '/users/:id/suspend',
      async ({ user, params, status }) => {
        const id = UserId.safeParse(params.id);

        if (!id.success) {
          return status(404, { error: AuthError.NotFound });
        }

        const result = await setSuspended(ctx, user, id.data, true);

        if (result.error) {
          return status(authErrorStatus(result.error), { error: result.error });
        }

        onSignedOut(id.data);

        return status(204);
      },
      { isAdmin: true },
    )
    .post(
      '/users/:id/unsuspend',
      async ({ user, params, status }) => {
        const id = UserId.safeParse(params.id);

        if (!id.success) {
          return status(404, { error: AuthError.NotFound });
        }

        const result = await setSuspended(ctx, user, id.data, false);

        return result.error
          ? status(authErrorStatus(result.error), { error: result.error })
          : status(204);
      },
      { isAdmin: true },
    )
    .post(
      '/users/:id/sign-out',
      async ({ user, params, status }) => {
        const id = UserId.safeParse(params.id);

        if (!id.success) {
          return status(404, { error: AuthError.NotFound });
        }

        const result = await signOutEverywhere(ctx, user, id.data);

        if (result.error) {
          return status(authErrorStatus(result.error), { error: result.error });
        }

        onSignedOut(id.data);

        return status(204);
      },
      { isAdmin: true },
    )
    .delete(
      '/users/:id',
      async ({ user, params, status }) => {
        const id = UserId.safeParse(params.id);

        if (!id.success) {
          return status(404, { error: AuthError.NotFound });
        }

        const result = await removeUser(ctx, user, id.data);

        if (result.error) {
          return status(authErrorStatus(result.error), { error: result.error });
        }

        onAccountRemoved(id.data);

        return status(204);
      },
      { isAdmin: true },
    );
}
