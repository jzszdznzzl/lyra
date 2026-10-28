import { Elysia } from 'elysia';
import { z } from 'zod';

import { AuthError, CreateApiTokenInput } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { authErrorStatus } from '../http-errors.ts';
import { createApiToken, listApiTokens, revokeApiToken } from './tokens.ts';
import type { AppContext } from '../context.ts';

const IdParams = z.object({ id: z.string().min(1).max(64) });

/** Personal tokens are managed from a signed-in session only, never with another token. */
export function apiTokenRoutes(ctx: AppContext) {
  return new Elysia({ prefix: '/tokens' })
    .use(authPlugin(ctx))
    .get('/', ({ user }) => listApiTokens(ctx, user.id), { isSignedIn: true })
    .post(
      '/',
      async ({ user, body, status }) => {
        const created = await createApiToken(ctx, user.id, body.name);

        return created.error
          ? status(authErrorStatus(created.error), { error: created.error })
          : status(201, created.data);
      },
      { isSignedIn: true, body: CreateApiTokenInput },
    )
    .delete(
      '/:id',
      async ({ user, params, status }) =>
        (await revokeApiToken(ctx, user.id, params.id))
          ? status(204)
          : status(404, { error: AuthError.NotFound }),
      { isSignedIn: true, params: IdParams },
    );
}
