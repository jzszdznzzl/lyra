import { Elysia } from 'elysia';

import { ListeningPreferences } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { sessionRateLimit } from '../security.ts';
import { preferencesFor, savePreferences } from './preferences.ts';
import type { AppContext } from '../context.ts';

interface PreferencesRoutesOptions {
  // Tells the account's other devices, so the change applies there at once.
  onSaved: (userId: string, preferences: ListeningPreferences, updatedAt: number) => void;
}

// Sliders save a moment after they stop moving, so even a busy minute stays well under this.
const SAVES_PER_MINUTE = 120;

export function preferencesRoutes(ctx: AppContext, { onSaved }: PreferencesRoutesOptions) {
  return new Elysia({ prefix: '/me' })
    .use(authPlugin(ctx))
    .use(sessionRateLimit(ctx, 'preferences', SAVES_PER_MINUTE))
    .get('/preferences', ({ user }) => preferencesFor(ctx, user.id), { isSignedIn: true })
    .put(
      '/preferences',
      async ({ body, user }) => {
        const saved = await savePreferences(ctx, user.id, body);
        onSaved(user.id, saved.preferences, saved.updatedAt);

        return saved;
      },
      { isSignedIn: true, body: ListeningPreferences },
    );
}
