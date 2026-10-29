import { eq } from 'drizzle-orm';

import { ListeningPreferences } from '@lyra/shared';
import type { SyncedPreferences } from '@lyra/shared';

import { schema } from '../db/index.ts';
import type { AppContext } from '../context.ts';

/** The account's saved preferences; a stored copy that no longer validates counts as none. */
export async function preferencesFor(ctx: AppContext, userId: string): Promise<SyncedPreferences> {
  const [row] = await ctx.db
    .select({
      preferences: schema.users.listeningPreferences,
      updatedAt: schema.users.listeningPreferencesUpdatedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  const parsed = ListeningPreferences.safeParse(row?.preferences);

  if (!parsed.success || row?.updatedAt === undefined || row.updatedAt === null) {
    return { preferences: null, updatedAt: null };
  }

  return { preferences: parsed.data, updatedAt: row.updatedAt };
}

/** Replaces the account's preferences; the newest save wins, whichever device sent it. */
export async function savePreferences(
  ctx: AppContext,
  userId: string,
  preferences: ListeningPreferences,
) {
  const updatedAt = ctx.now();

  await ctx.db
    .update(schema.users)
    .set({ listeningPreferences: preferences, listeningPreferencesUpdatedAt: updatedAt })
    .where(eq(schema.users.id, userId));

  return { preferences, updatedAt };
}
