import { eq } from 'drizzle-orm';

import { schema } from '../db/index.ts';
import { deleteAvatar } from './avatar.ts';
import type { AppContext } from '../context.ts';

/**
 * Removes the account and everything tied to it: sessions, passkeys, tokens, email tokens and
 * the Google link go with the row (ON DELETE CASCADE); the avatar is a file, removed here.
 */
export async function deleteAccount(ctx: AppContext, userId: string) {
  await deleteAvatar(ctx.dataDir, userId);
  await ctx.db.delete(schema.users).where(eq(schema.users.id, userId));
}
