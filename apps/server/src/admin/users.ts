import { desc, eq } from 'drizzle-orm';

import { AuthError, err, ok } from '@lyra/shared';
import type { AdminUser, Result } from '@lyra/shared';

import { revokeAllSessions } from '../auth/sessions.ts';
import { schema } from '../db/index.ts';
import { deleteAccount } from '../users/delete-account.ts';
import { isAdmin } from './admins.ts';
import type { User } from '../auth/sessions.ts';
import type { AppContext } from '../context.ts';

export async function listUsers(ctx: AppContext): Promise<AdminUser[]> {
  const rows = await ctx.db
    .select({ user: schema.users, googleUserId: schema.googleAccounts.userId })
    .from(schema.users)
    .leftJoin(schema.googleAccounts, eq(schema.googleAccounts.userId, schema.users.id))
    .orderBy(desc(schema.users.createdAt));

  return rows.map(({ user, googleUserId }) => ({
    id: user.id,
    username: user.username,
    name: user.name,
    avatarUrl:
      user.avatarVersion === null ? null : `/api/avatars/${user.id}.webp?v=${user.avatarVersion}`,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
    isVerified: user.emailVerifiedAt !== null,
    isGoogleLinked: googleUserId !== null,
    isSuspended: user.suspendedAt !== null,
    isAdmin: isAdmin(ctx, user),
  }));
}

/** The account an admin wants to act on, unless it is their own or another admin's. */
async function target(ctx: AppContext, admin: User, id: string): Promise<Result<User, AuthError>> {
  const [user] = await ctx.db.select().from(schema.users).where(eq(schema.users.id, id));

  if (!user) {
    return err(AuthError.NotFound);
  }

  return user.id === admin.id || isAdmin(ctx, user) ? err(AuthError.ProtectedAccount) : ok(user);
}

export async function setSuspended(
  ctx: AppContext,
  admin: User,
  id: string,
  isSuspended: boolean,
): Promise<Result<null, AuthError>> {
  const found = await target(ctx, admin, id);

  if (found.error) {
    return err(found.error);
  }

  await ctx.db
    .update(schema.users)
    .set({ suspendedAt: isSuspended ? ctx.now() : null })
    .where(eq(schema.users.id, id));

  if (isSuspended) {
    await revokeAllSessions(ctx, id);
  }

  return ok(null);
}

export async function signOutEverywhere(
  ctx: AppContext,
  admin: User,
  id: string,
): Promise<Result<null, AuthError>> {
  const found = await target(ctx, admin, id);

  if (found.error) {
    return err(found.error);
  }

  await revokeAllSessions(ctx, id);

  return ok(null);
}

export async function removeUser(
  ctx: AppContext,
  admin: User,
  id: string,
): Promise<Result<null, AuthError>> {
  const found = await target(ctx, admin, id);

  if (found.error) {
    return err(found.error);
  }

  await deleteAccount(ctx, id);

  return ok(null);
}
