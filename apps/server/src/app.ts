import { Elysia } from 'elysia';

import type { PublicConfig } from '@lyra/shared';

import { ChallengeStore } from './auth/passkeys.ts';
import { authRoutes } from './auth/routes.ts';
import { connectRoutes } from './connect/routes.ts';
import { isGoogleLinked } from './google/accounts.ts';
import { googleRoutes } from './google/routes.ts';
import { ImageRegistry } from './images/registry.ts';
import { imageRoutes } from './images/routes.ts';
import { lyricsRoutes } from './lyrics/routes.ts';
import { streamRoutes } from './stream/routes.ts';
import { originGuard } from './security.ts';
import { userRoutes } from './users/routes.ts';
import { InnertubePool } from './ytmusic/innertube.ts';
import { musicRoutes } from './ytmusic/routes.ts';
import type { AppContext } from './context.ts';
import type { RemoteLoginTarget } from './google/remote-login.ts';

export interface AppOptions {
  loginTarget?: RemoteLoginTarget;
}

export function createApp(ctx: AppContext, options: AppOptions = {}) {
  const challenges = new ChallengeStore(ctx.now);
  const pool = new InnertubePool(ctx.dataDir);
  const images = new ImageRegistry(ctx);
  const linked = (userId: string) => isGoogleLinked(ctx, userId);

  return new Elysia({ prefix: '/api' })
    .use(originGuard(ctx))
    .get('/health', () => ({ status: 'ok' }))
    .get('/config', (): PublicConfig => ({ isRegistrationEnabled: ctx.env.REGISTRATION_ENABLED }))
    .use(authRoutes(ctx, { challenges, isGoogleLinked: linked }))
    .use(
      userRoutes(ctx, {
        challenges,
        isGoogleLinked: linked,
        onAccountDeleted: (userId) => pool.forget(userId),
      }),
    )
    .use(
      googleRoutes(ctx, {
        pool,
        images,
        ...(options.loginTarget ? { loginTarget: options.loginTarget } : {}),
      }),
    )
    .use(musicRoutes(ctx, pool, images))
    .use(streamRoutes(ctx, pool))
    .use(lyricsRoutes(ctx, pool))
    .use(connectRoutes(ctx))
    .use(imageRoutes(ctx, images));
}

export type App = ReturnType<typeof createApp>;
