import { eq } from 'drizzle-orm';

import { GoogleLinkMethod } from '@lyra/shared';
import type { GoogleAccount } from '@lyra/shared';

import { decrypt, encrypt } from '../common/index.ts';
import { schema } from '../db/index.ts';
import type { AppContext } from '../context.ts';

export interface GoogleIdentity {
  name: string;
  email: string | null;
  photo: string | null;
}

function toMethod(value: string): GoogleLinkMethod {
  return (
    Object.values(GoogleLinkMethod).find((method) => method === value) ?? GoogleLinkMethod.Cookies
  );
}

export async function saveGoogleAccount(
  ctx: AppContext,
  userId: string,
  cookie: string,
  method: GoogleLinkMethod,
  identity: GoogleIdentity,
): Promise<GoogleAccount> {
  const row = {
    userId,
    cookieCiphertext: encrypt(cookie, ctx.secretKey),
    method,
    ...identity,
    linkedAt: ctx.now(),
  };

  await ctx.db
    .insert(schema.googleAccounts)
    .values(row)
    .onConflictDoUpdate({ target: schema.googleAccounts.userId, set: row });

  return { name: row.name, email: row.email, photo: row.photo, method, linkedAt: row.linkedAt };
}

export async function getGoogleAccount(
  ctx: AppContext,
  userId: string,
): Promise<GoogleAccount | null> {
  const [row] = await ctx.db
    .select()
    .from(schema.googleAccounts)
    .where(eq(schema.googleAccounts.userId, userId));

  return row
    ? {
        name: row.name,
        email: row.email,
        photo: row.photo,
        method: toMethod(row.method),
        linkedAt: row.linkedAt,
      }
    : null;
}

/** The decrypted cookie header, or null when not linked or SECRET_KEY changed. */
export async function getGoogleCookie(ctx: AppContext, userId: string) {
  const [row] = await ctx.db
    .select({ cookieCiphertext: schema.googleAccounts.cookieCiphertext })
    .from(schema.googleAccounts)
    .where(eq(schema.googleAccounts.userId, userId));

  return row ? decrypt(row.cookieCiphertext, ctx.secretKey) : null;
}

export async function isGoogleLinked(ctx: AppContext, userId: string) {
  return (await getGoogleAccount(ctx, userId)) !== null;
}

export async function unlinkGoogleAccount(ctx: AppContext, userId: string) {
  await ctx.db.delete(schema.googleAccounts).where(eq(schema.googleAccounts.userId, userId));
}
