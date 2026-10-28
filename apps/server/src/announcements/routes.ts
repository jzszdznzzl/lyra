import { Elysia } from 'elysia';

import { authPlugin } from '../auth/plugin.ts';
import { activeAnnouncements } from './announcements.ts';
import type { AppContext } from '../context.ts';

export function announcementRoutes(ctx: AppContext) {
  return new Elysia()
    .use(authPlugin(ctx))
    .get('/announcements', () => activeAnnouncements(ctx), { isSignedIn: true });
}
