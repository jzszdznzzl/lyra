import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  AVATAR_MAX_BYTES,
  AuthError,
  ChangePasswordInput,
  PasskeyRegistrationInput,
  RenamePasskeyInput,
  UpdateProfileInput,
} from '@lyra/shared';
import type { SessionInfo } from '@lyra/shared';

import { changePassword } from '../auth/accounts.ts';
import {
  deletePasskey,
  finishPasskeyRegistration,
  listPasskeys,
  renamePasskey,
  startPasskeyRegistration,
} from '../auth/passkeys.ts';
import { authPlugin } from '../auth/plugin.ts';
import { listSessions, revokeOtherSessions, revokeSession } from '../auth/sessions.ts';
import { describeUserAgent } from '../common/index.ts';
import { schema } from '../db/index.ts';
import { authErrorStatus } from '../http-errors.ts';
import { avatarPath, deleteAvatar, saveAvatar } from './avatar.ts';
import { toUserProfile } from './profile.ts';
import type { ChallengeStore } from '../auth/passkeys.ts';
import type { AppContext } from '../context.ts';

export interface UserRoutesOptions {
  challenges: ChallengeStore;
  isGoogleLinked: (userId: string) => Promise<boolean>;
}

const AvatarUpload = z.object({ file: z.file().max(AVATAR_MAX_BYTES) });
const IdParams = z.object({ id: z.string().min(1).max(512) });
const AvatarParams = z.object({ file: z.string().regex(/^[0-9a-f-]{36}\.webp$/) });

export function userRoutes(ctx: AppContext, options: UserRoutesOptions) {
  const { challenges, isGoogleLinked } = options;

  return (
    new Elysia()
      .use(authPlugin(ctx))
      .get('/me', async ({ user }) => toUserProfile(user, await isGoogleLinked(user.id)), {
        isSignedIn: true,
      })
      .patch(
        '/me',
        async ({ body, user }) => {
          const [updated] = await ctx.db
            .update(schema.users)
            .set(body)
            .where(eq(schema.users.id, user.id))
            .returning();

          return toUserProfile(updated ?? user, await isGoogleLinked(user.id));
        },
        { isSignedIn: true, body: UpdateProfileInput },
      )
      .put(
        '/me/avatar',
        async ({ body, user, status }) => {
          const saved = await saveAvatar(ctx.dataDir, user.id, await body.file.arrayBuffer());

          if (saved.error) {
            return status(authErrorStatus(saved.error), { error: saved.error });
          }

          const [updated] = await ctx.db
            .update(schema.users)
            .set({ avatarVersion: (user.avatarVersion ?? 0) + 1 })
            .where(eq(schema.users.id, user.id))
            .returning();

          return toUserProfile(updated ?? user, await isGoogleLinked(user.id));
        },
        { isSignedIn: true, body: AvatarUpload },
      )
      .delete(
        '/me/avatar',
        async ({ user }) => {
          await deleteAvatar(ctx.dataDir, user.id);
          const [updated] = await ctx.db
            .update(schema.users)
            .set({ avatarVersion: null })
            .where(eq(schema.users.id, user.id))
            .returning();

          return toUserProfile(updated ?? user, await isGoogleLinked(user.id));
        },
        { isSignedIn: true },
      )
      .post(
        '/me/password',
        async ({ body, user, session, status }) => {
          const result = await changePassword(ctx, user, body);

          if (result.error) {
            return status(authErrorStatus(result.error), { error: result.error });
          }

          // Anyone who learned the old password loses access; this device stays signed in.
          await revokeOtherSessions(ctx, user.id, session.id);

          return status(204);
        },
        { isSignedIn: true, body: ChangePasswordInput },
      )
      .get(
        '/avatars/:file',
        async ({ params, status }) => {
          const file = Bun.file(avatarPath(ctx.dataDir, params.file.replace(/\.webp$/, '')));

          if (!(await file.exists())) {
            return status(404, { error: AuthError.NotFound });
          }

          // The URL carries a version, so the image never changes behind it.
          return new Response(file, {
            headers: { 'cache-control': 'private, max-age=31536000, immutable' },
          });
        },
        { isSignedIn: true, params: AvatarParams },
      )
      // --- Sessions ---
      .get(
        '/sessions',
        async ({ user, session }) => {
          const rows = await listSessions(ctx, user.id);

          return rows.map((row): SessionInfo => ({
            id: row.id,
            device: describeUserAgent(row.userAgent),
            ip: row.ip,
            createdAt: row.createdAt,
            lastSeenAt: row.lastSeenAt,
            isCurrent: row.id === session.id,
          }));
        },
        { isSignedIn: true },
      )
      .delete(
        '/sessions/:id',
        async ({ params, user, status }) => {
          const isRevoked = await revokeSession(ctx, user.id, params.id);

          return isRevoked ? status(204) : status(404, { error: AuthError.NotFound });
        },
        { isSignedIn: true, params: IdParams },
      )
      .delete(
        '/sessions',
        async ({ user, session, status }) => {
          await revokeOtherSessions(ctx, user.id, session.id);

          return status(204);
        },
        { isSignedIn: true },
      )
      // --- Passkeys ---
      .get('/passkeys', ({ user }) => listPasskeys(ctx, user.id), { isSignedIn: true })
      .post('/passkeys/options', ({ user }) => startPasskeyRegistration(ctx, challenges, user), {
        isSignedIn: true,
      })
      .post(
        '/passkeys',
        async ({ body, user, status }) => {
          const result = await finishPasskeyRegistration(ctx, challenges, user, body);

          if (result.error) {
            return status(authErrorStatus(result.error), { error: result.error });
          }

          return status(201, result.data);
        },
        { isSignedIn: true, body: PasskeyRegistrationInput },
      )
      .patch(
        '/passkeys/:id',
        async ({ params, body, user, status }) => {
          const isRenamed = await renamePasskey(ctx, user.id, params.id, body.name);

          return isRenamed ? status(204) : status(404, { error: AuthError.NotFound });
        },
        { isSignedIn: true, params: IdParams, body: RenamePasskeyInput },
      )
      .delete(
        '/passkeys/:id',
        async ({ params, user, status }) => {
          const isDeleted = await deletePasskey(ctx, user.id, params.id);

          return isDeleted ? status(204) : status(404, { error: AuthError.NotFound });
        },
        { isSignedIn: true, params: IdParams },
      )
  );
}
