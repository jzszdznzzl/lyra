import { and, desc, eq, gt } from 'drizzle-orm';

import { AnnouncementLevel } from '@lyra/shared';
import type { Announcement, CreateAnnouncementInput } from '@lyra/shared';

import { schema } from '../db/index.ts';
import type { AppContext } from '../context.ts';

type AnnouncementRow = typeof schema.announcements.$inferSelect;

const MINUTE_MS = 60 * 1000;
// The panel shows what is live plus the latest ones that ended, for reference.
const RECENT_LIMIT = 20;

function toAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    message: row.message,
    // An unknown stored level shows as plain information rather than failing the whole list.
    level:
      Object.values(AnnouncementLevel).find((level) => level === row.level) ??
      AnnouncementLevel.Info,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export async function activeAnnouncements(ctx: AppContext) {
  const rows = await ctx.db
    .select()
    .from(schema.announcements)
    .where(gt(schema.announcements.expiresAt, ctx.now()))
    .orderBy(desc(schema.announcements.createdAt));

  return rows.map(toAnnouncement);
}

export async function recentAnnouncements(ctx: AppContext) {
  const rows = await ctx.db
    .select()
    .from(schema.announcements)
    .orderBy(desc(schema.announcements.createdAt))
    .limit(RECENT_LIMIT);

  return rows.map(toAnnouncement);
}

export async function createAnnouncement(
  ctx: AppContext,
  adminId: string,
  input: CreateAnnouncementInput,
) {
  const now = ctx.now();
  const row: AnnouncementRow = {
    id: Bun.randomUUIDv7(),
    message: input.message,
    level: input.level,
    createdBy: adminId,
    createdAt: now,
    expiresAt: now + input.durationMinutes * MINUTE_MS,
  };

  await ctx.db.insert(schema.announcements).values(row);

  return toAnnouncement(row);
}

/** Ends an announcement now; returns false when there was no live one with that id. */
export async function endAnnouncement(ctx: AppContext, id: string) {
  const now = ctx.now();
  const ended = await ctx.db
    .update(schema.announcements)
    .set({ expiresAt: now })
    .where(and(eq(schema.announcements.id, id), gt(schema.announcements.expiresAt, now)))
    .returning({ id: schema.announcements.id });

  return ended.length > 0;
}
