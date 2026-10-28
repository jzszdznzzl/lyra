import { and, count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { API_TOKEN_PREFIX, AuthError, MAX_API_TOKENS, TokenScope, err, ok } from '@lyra/shared';
import type { ApiTokenInfo, CreatedApiToken, Result } from '@lyra/shared';

import { randomToken, sha256 } from '../common/index.ts';
import { schema } from '../db/index.ts';
import type { User } from '../auth/sessions.ts';
import type { AppContext } from '../context.ts';

type ApiTokenRow = typeof schema.apiTokens.$inferSelect;

// Scopes are stored as JSON; anything unknown (a removed permission) grants nothing.
const StoredScopes = z.array(z.unknown()).transform((values) =>
  values.flatMap((value) => {
    const scope = z.enum(TokenScope).safeParse(value);

    return scope.success ? [scope.data] : [];
  }),
);

// Clients poll often; writing on every request would wear the database for nothing.
const TOUCH_INTERVAL_MS = 60 * 1000;

function toInfo(row: ApiTokenRow): ApiTokenInfo {
  const scopes = StoredScopes.safeParse(row.scopes);

  return {
    id: row.id,
    name: row.name,
    scopes: scopes.success ? scopes.data : [],
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

export async function listApiTokens(ctx: AppContext, userId: string) {
  const rows = await ctx.db
    .select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.userId, userId))
    .orderBy(desc(schema.apiTokens.createdAt));

  return rows.map(toInfo);
}

/** Every token reads what the user is playing; it is the only permission there is for now. */
export async function createApiToken(
  ctx: AppContext,
  userId: string,
  name: string,
): Promise<Result<CreatedApiToken, AuthError>> {
  const [existing] = await ctx.db
    .select({ total: count() })
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.userId, userId));

  if ((existing?.total ?? 0) >= MAX_API_TOKENS) {
    return err(AuthError.TooManyTokens);
  }

  const token = `${API_TOKEN_PREFIX}${randomToken()}`;
  const row: ApiTokenRow = {
    id: Bun.randomUUIDv7(),
    userId,
    name,
    tokenHash: sha256(token),
    scopes: [TokenScope.NowPlayingRead],
    createdAt: ctx.now(),
    lastUsedAt: null,
  };

  await ctx.db.insert(schema.apiTokens).values(row);

  return ok({ token, info: toInfo(row) });
}

export async function revokeApiToken(ctx: AppContext, userId: string, id: string) {
  const deleted = await ctx.db
    .delete(schema.apiTokens)
    .where(and(eq(schema.apiTokens.id, id), eq(schema.apiTokens.userId, userId)))
    .returning({ id: schema.apiTokens.id });

  return deleted.length > 0;
}

/** The token's owner, when it exists and carries `scope`; null otherwise. */
export async function findApiTokenUser(
  ctx: AppContext,
  token: string,
  scope: TokenScope,
): Promise<{ user: User; tokenId: string } | null> {
  if (!token.startsWith(API_TOKEN_PREFIX)) {
    return null;
  }

  const [row] = await ctx.db
    .select({ token: schema.apiTokens, user: schema.users })
    .from(schema.apiTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.apiTokens.userId))
    .where(eq(schema.apiTokens.tokenHash, sha256(token)));

  if (!row || !toInfo(row.token).scopes.includes(scope)) {
    return null;
  }

  const now = ctx.now();

  if (row.token.lastUsedAt === null || now - row.token.lastUsedAt >= TOUCH_INTERVAL_MS) {
    await ctx.db
      .update(schema.apiTokens)
      .set({ lastUsedAt: now })
      .where(eq(schema.apiTokens.id, row.token.id));
  }

  return { user: row.user, tokenId: row.token.id };
}
