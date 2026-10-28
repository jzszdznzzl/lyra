import { Elysia } from 'elysia';
import { z } from 'zod';

import { AdminError, AuthError, CreateAnnouncementInput, UpdateSettingsInput } from '@lyra/shared';

import {
  createAnnouncement,
  endAnnouncement,
  recentAnnouncements,
} from '../announcements/announcements.ts';
import { authErrorStatus } from '../http-errors.ts';
import { INVALID_BODY } from '../query.ts';
import { adminPlugin } from './plugin.ts';
import { settingsView, testMail } from './settings.ts';
import { listUsers, removeUser, setSuspended, signOutEverywhere } from './users.ts';
import type { AppContext } from '../context.ts';

export interface AdminRoutesOptions {
  // Drops what lives in memory for an account (YouTube clients, open Connect sockets).
  onAccountRemoved: (userId: string) => void;
  // Closes the account's open devices, so a suspension or sign-out applies right away.
  onSignedOut: (userId: string) => void;
  // Tells every open app to fetch announcements again.
  onAnnouncementsChanged: () => void;
}

// Checked inside the handlers, after the admin check: route-level schemas run first, and a 422
// for a stranger would reveal that the route exists.
const RowId = z.string().min(1).max(64);

export function adminRoutes(ctx: AppContext, options: AdminRoutesOptions) {
  const { onAccountRemoved, onSignedOut, onAnnouncementsChanged } = options;

  return (
    new Elysia({ prefix: '/admin' })
      .use(adminPlugin(ctx))
      .get('/users', () => listUsers(ctx), { isAdmin: true })
      .post(
        '/users/:id/suspend',
        async ({ user, params, status }) => {
          const id = RowId.safeParse(params.id);

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
          const id = RowId.safeParse(params.id);

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
          const id = RowId.safeParse(params.id);

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
          const id = RowId.safeParse(params.id);

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
      )
      // --- Announcements ---
      .get('/announcements', () => recentAnnouncements(ctx), { isAdmin: true })
      .post(
        '/announcements',
        async ({ user, body, status }) => {
          const input = CreateAnnouncementInput.safeParse(body);

          if (!input.success) {
            return status(422, INVALID_BODY);
          }

          const created = await createAnnouncement(ctx, user.id, input.data);
          onAnnouncementsChanged();

          return status(201, created);
        },
        { isAdmin: true },
      )
      .delete(
        '/announcements/:id',
        async ({ params, status }) => {
          const id = RowId.safeParse(params.id);

          if (!id.success || !(await endAnnouncement(ctx, id.data))) {
            return status(404, { error: AuthError.NotFound });
          }

          onAnnouncementsChanged();

          return status(204);
        },
        { isAdmin: true },
      )
      // --- Settings ---
      .get('/settings', () => settingsView(ctx), { isAdmin: true })
      .patch(
        '/settings',
        async ({ body, status }) => {
          const input = UpdateSettingsInput.safeParse(body);

          if (!input.success) {
            return status(422, INVALID_BODY);
          }

          ctx.settings.update(input.data);

          return settingsView(ctx);
        },
        { isAdmin: true },
      )
      .post(
        '/settings/test-mail',
        async ({ user, status }) => {
          try {
            await ctx.mailer.send(testMail(user));
          } catch (error) {
            // The reason (wrong password, unknown host…) is what the admin needs to fix it.
            const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);

            return status(502, { error: AdminError.MailFailed, reason });
          }

          return status(204);
        },
        { isAdmin: true },
      )
  );
}
