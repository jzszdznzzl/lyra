import { and, eq, gt, isNull } from 'drizzle-orm';

import { randomToken, sha256 } from '../common/index.ts';
import { schema } from '../db/index.ts';
import type { AppContext } from '../context.ts';

export const EmailTokenPurpose = Object.freeze({
  VerifyEmail: 'verify_email',
  ResetPassword: 'reset_password',
} as const);

export type EmailTokenPurpose = (typeof EmailTokenPurpose)[keyof typeof EmailTokenPurpose];

export const EMAIL_TOKEN_TTL_MS: Record<EmailTokenPurpose, number> = {
  [EmailTokenPurpose.VerifyEmail]: 24 * 60 * 60 * 1000,
  [EmailTokenPurpose.ResetPassword]: 60 * 60 * 1000,
};

/** Issues a single-use token; older unused tokens for the same purpose stop working. */
export async function issueEmailToken(ctx: AppContext, userId: string, purpose: EmailTokenPurpose) {
  const token = randomToken();
  const now = ctx.now();

  await ctx.db
    .delete(schema.emailTokens)
    .where(
      and(
        eq(schema.emailTokens.userId, userId),
        eq(schema.emailTokens.purpose, purpose),
        isNull(schema.emailTokens.usedAt),
      ),
    );

  await ctx.db.insert(schema.emailTokens).values({
    id: Bun.randomUUIDv7(),
    userId,
    purpose,
    tokenHash: sha256(token),
    createdAt: now,
    expiresAt: now + EMAIL_TOKEN_TTL_MS[purpose],
    usedAt: null,
  });

  return token;
}

/** Marks the token used and returns its user ID, or null if it is unknown, used or expired. */
export async function consumeEmailToken(
  ctx: AppContext,
  token: string,
  purpose: EmailTokenPurpose,
) {
  const now = ctx.now();
  const [row] = await ctx.db
    .update(schema.emailTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(schema.emailTokens.tokenHash, sha256(token)),
        eq(schema.emailTokens.purpose, purpose),
        isNull(schema.emailTokens.usedAt),
        gt(schema.emailTokens.expiresAt, now),
      ),
    )
    .returning({ userId: schema.emailTokens.userId });

  return row?.userId ?? null;
}

/** Returns the token's user ID without using it up, or null if it is unknown, used or expired. */
export async function peekEmailToken(ctx: AppContext, token: string, purpose: EmailTokenPurpose) {
  const [row] = await ctx.db
    .select({ userId: schema.emailTokens.userId })
    .from(schema.emailTokens)
    .where(
      and(
        eq(schema.emailTokens.tokenHash, sha256(token)),
        eq(schema.emailTokens.purpose, purpose),
        isNull(schema.emailTokens.usedAt),
        gt(schema.emailTokens.expiresAt, ctx.now()),
      ),
    );

  return row?.userId ?? null;
}
