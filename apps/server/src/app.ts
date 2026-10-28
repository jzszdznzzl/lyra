import { Elysia } from 'elysia';

import { ChallengeStore } from './auth/passkeys.ts';
import { authRoutes } from './auth/routes.ts';
import { connectRoutes } from './connect/routes.ts';
import { isGoogleLinked } from './google/accounts.ts';
import { googleRoutes } from './google/routes.ts';
import { lyricsRoutes } from './lyrics/routes.ts';
import { streamRoutes } from './stream/routes.ts';
import { userRoutes } from './users/routes.ts';
import { imageProxyRoutes } from './ytmusic/image-proxy.ts';
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
  const linked = (userId: string) => isGoogleLinked(ctx, userId);

  return new Elysia({ prefix: '/api' })
    .get('/health', () => ({ status: 'ok' }))
    .use(authRoutes(ctx, { challenges, isGoogleLinked: linked }))
    .use(userRoutes(ctx, { challenges, isGoogleLinked: linked }))
    .use(
      googleRoutes(ctx, {
        pool,
        ...(options.loginTarget ? { loginTarget: options.loginTarget } : {}),
      }),
    )
    .use(musicRoutes(ctx, pool))
    .use(streamRoutes(ctx, pool))
    .use(lyricsRoutes(ctx, pool))
    .use(connectRoutes(ctx))
    .use(imageProxyRoutes(ctx));
}

export type App = ReturnType<typeof createApp>;
