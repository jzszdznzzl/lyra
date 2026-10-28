import { Elysia } from 'elysia';

import { ChallengeStore } from './auth/passkeys.ts';
import { authRoutes } from './auth/routes.ts';
import { userRoutes } from './users/routes.ts';
import type { AppContext } from './context.ts';

export function createApp(ctx: AppContext) {
  const challenges = new ChallengeStore(ctx.now);
  // Replaced by the real lookup when Google linking lands.
  const isGoogleLinked = () => Promise.resolve(false);

  return new Elysia({ prefix: '/api' })
    .get('/health', () => ({ status: 'ok' }))
    .use(authRoutes(ctx, { challenges, isGoogleLinked }))
    .use(userRoutes(ctx, { challenges, isGoogleLinked }));
}

export type App = ReturnType<typeof createApp>;
