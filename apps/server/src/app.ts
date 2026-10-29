import { Elysia } from 'elysia';

import type { PublicConfig } from '@lyra/shared';

import { adminRoutes } from './admin/routes.ts';
import { announcementRoutes } from './announcements/routes.ts';
import { apiTokenRoutes } from './api-tokens/routes.ts';
import { ChallengeStore } from './auth/passkeys.ts';
import { authRoutes } from './auth/routes.ts';
import { ConnectHub } from './connect/hub.ts';
import { connectRoutes } from './connect/routes.ts';
import { isGoogleLinked } from './google/accounts.ts';
import { googleRoutes } from './google/routes.ts';
import { httpLog } from './http-log.ts';
import { ImageRegistry } from './images/registry.ts';
import { imageRoutes } from './images/routes.ts';
import { lyricsRoutes } from './lyrics/routes.ts';
import { NowPlayingService } from './now-playing/now-playing.ts';
import { nowPlayingRoutes } from './now-playing/routes.ts';
import { WidgetCovers } from './now-playing/widget-covers.ts';
import { preferencesRoutes } from './preferences/routes.ts';
import { streamRoutes } from './stream/routes.ts';
import { PushService } from './push/push.ts';
import { pushRoutes } from './push/routes.ts';
import { recapRoutes } from './recap/routes.ts';
import { originGuard } from './security.ts';
import { socialRoutes } from './social/routes.ts';
import { userRoutes } from './users/routes.ts';
import { InnertubePool } from './ytmusic/innertube.ts';
import { musicRoutes } from './ytmusic/routes.ts';
import type { AppContext } from './context.ts';
import type { RemoteLoginTarget } from './google/remote-login.ts';
import type { PushSender } from './push/push.ts';

export interface AppOptions {
  loginTarget?: RemoteLoginTarget;
  // Tests pass a fake, so nothing reaches real push services.
  pushSender?: PushSender;
}

export function createApp(ctx: AppContext, options: AppOptions = {}) {
  const challenges = new ChallengeStore(ctx.now);
  const pool = new InnertubePool(ctx.dataDir);
  const images = new ImageRegistry(ctx);
  const linked = (userId: string) => isGoogleLinked(ctx, userId);
  const hub = new ConnectHub(ctx.now);
  const signOut = (userId: string) => hub.kick(userId);
  const forget = (userId: string) => {
    pool.forget(userId);
    hub.kick(userId);
  };
  const nowPlaying = new NowPlayingService(ctx, hub);
  const push = new PushService(ctx, options.pushSender);
  const covers = new WidgetCovers(images, new URL(ctx.env.PUBLIC_URL).origin);

  return new Elysia({ prefix: '/api' })
    .use(httpLog())
    .use(originGuard(ctx))
    .get('/health', () => ({ status: 'ok' }))
    .get('/config', (): PublicConfig => ({
      isRegistrationEnabled: ctx.settings.current.isRegistrationEnabled,
    }))
    .use(authRoutes(ctx, { challenges, isGoogleLinked: linked }))
    .use(
      userRoutes(ctx, {
        challenges,
        isGoogleLinked: linked,
        onAccountDeleted: forget,
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
    .use(socialRoutes(ctx, pool, images, nowPlaying, push))
    .use(pushRoutes(ctx, push))
    .use(recapRoutes(ctx, images))
    .use(
      preferencesRoutes(ctx, {
        onSaved: (userId, preferences, updatedAt) =>
          hub.sendTo(userId, { type: 'preferences', preferences, updatedAt }),
      }),
    )
    .use(streamRoutes(ctx, pool))
    .use(lyricsRoutes(ctx, pool))
    .use(connectRoutes(ctx, hub))
    .use(apiTokenRoutes(ctx))
    .use(
      adminRoutes(ctx, {
        onAccountRemoved: forget,
        onSignedOut: signOut,
        onAnnouncementsChanged: () => hub.broadcastAll({ type: 'announcements' }),
        onlineNow: () => hub.onlineUsers(),
      }),
    )
    .use(announcementRoutes(ctx))
    .use(nowPlayingRoutes(ctx, nowPlaying, covers))
    .use(imageRoutes(ctx, images));
}

export type App = ReturnType<typeof createApp>;
