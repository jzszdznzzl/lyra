import { Elysia } from 'elysia';
import { z } from 'zod';

import { LyricsQuery } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { musicClient } from '../ytmusic/clients.ts';
import { LyricsService } from './lyrics.ts';
import type { AppContext } from '../context.ts';
import type { InnertubePool } from '../ytmusic/innertube.ts';

const VideoParams = z.object({ id: z.string().regex(/^[\w-]{11}$/) });

export function lyricsRoutes(ctx: AppContext, pool: InnertubePool) {
  const service = new LyricsService();

  return new Elysia().use(authPlugin(ctx)).get(
    '/lyrics/:id',
    async ({ user, params, query }) => ({
      lyrics: await service.find(await musicClient(ctx, pool, user), params.id, query),
    }),
    { isSignedIn: true, params: VideoParams, query: LyricsQuery },
  );
}
