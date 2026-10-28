import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';

import { randomToken, sha256 } from '../common/index.ts';
import { schema } from '../db/index.ts';
import type { AppContext } from '../context.ts';

export interface ClientInfo {
  userAgent: string;
  ip: string;
}

export type Session = typeof schema.sessions.$inferSelect;
export type User = typeof schema.users.$inferSelect;

export const SESSION_COOKIE = 'lyra_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Writing on every request would wear the database for nothing; once a minute is precise enough.
const TOUCH_INTERVAL_MS = 60 * 1000;

export async function createSession(ctx: AppContext, userId: string, client: ClientInfo) {
  const token = randomToken();
  const now = ctx.now();
  const session: Session = {
    id: Bun.randomUUIDv7(),
    userId,
    tokenHash: sha256(token),
    userAgent: client.userAgent,
    ip: client.ip,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  await ctx.db.insert(schema.sessions).values(session);
  await ctx.db.update(schema.users).set({ lastActiveAt: now }).where(eq(schema.users.id, userId));

  return { token, session };
}

/** Resolves a cookie token to its live session and user, sliding the expiry forward. */
export async function findSession(ctx: AppContext, token: string, client: ClientInfo) {
  const now = ctx.now();
  const [row] = await ctx.db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, sha256(token)),
        gt(schema.sessions.expiresAt, now),
        // A suspended account has no valid session, whatever cookies are still around.
        isNull(schema.users.suspendedAt),
      ),
    );

  if (!row) {
    return null;
  }

  if (now - row.session.lastSeenAt >= TOUCH_INTERVAL_MS) {
    const touched = { lastSeenAt: now, expiresAt: now + SESSION_TTL_MS, ip: client.ip };
    await ctx.db.update(schema.sessions).set(touched).where(eq(schema.sessions.id, row.session.id));
    Object.assign(row.session, touched);
    await ctx.db
      .update(schema.users)
      .set({ lastActiveAt: now })
      .where(eq(schema.users.id, row.user.id));
    row.user.lastActiveAt = now;
  }

  return row;
}

export function listSessions(ctx: AppContext, userId: string) {
  return ctx.db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), gt(schema.sessions.expiresAt, ctx.now())))
    .orderBy(desc(schema.sessions.lastSeenAt));
}

export async function revokeSession(ctx: AppContext, userId: string, sessionId: string) {
  const deleted = await ctx.db
    .delete(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.id, sessionId)))
    .returning({ id: schema.sessions.id });

  return deleted.length > 0;
}

export async function revokeOtherSessions(ctx: AppContext, userId: string, keepSessionId: string) {
  await ctx.db
    .delete(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, keepSessionId)));
}

export async function revokeAllSessions(ctx: AppContext, userId: string) {
  await ctx.db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
