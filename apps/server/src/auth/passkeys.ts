import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { and, desc, eq } from 'drizzle-orm';

import { AuthError, err, ok } from '@lyra/shared';
import type {
  PasskeyInfo,
  PasskeyLoginInput,
  PasskeyRegistrationInput,
  Result,
} from '@lyra/shared';

import { schema } from '../db/index.ts';
import type { AppContext } from '../context.ts';
import type { User } from './sessions.ts';

interface PendingChallenge {
  challenge: string;
  // Null for sign-in: the user is only known once the authenticator answers.
  userId: string | null;
  expiresAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RP_NAME = 'Lyra';
const DEFAULT_PASSKEY_NAME = 'Passkey';

function relyingParty(ctx: AppContext) {
  const url = new URL(ctx.env.PUBLIC_URL);

  return { rpID: url.hostname, origin: url.origin };
}

/** Challenges live in memory: they last minutes and a restart only means trying again. */
export class ChallengeStore {
  #pending = new Map<string, PendingChallenge>();
  #now: () => number;

  constructor(now: () => number) {
    this.#now = now;
  }

  save(challenge: string, userId: string | null) {
    const id = crypto.randomUUID();
    const now = this.#now();

    for (const [key, value] of this.#pending) {
      if (value.expiresAt <= now) {
        this.#pending.delete(key);
      }
    }

    this.#pending.set(id, { challenge, userId, expiresAt: now + CHALLENGE_TTL_MS });

    return id;
  }

  /** Single use: the challenge is removed whether or not it is still valid. */
  take(id: string) {
    const pending = this.#pending.get(id);
    this.#pending.delete(id);

    if (!pending || pending.expiresAt <= this.#now()) {
      return null;
    }

    return pending;
  }
}

export async function startPasskeyRegistration(
  ctx: AppContext,
  challenges: ChallengeStore,
  user: User,
) {
  const existing = await ctx.db
    .select({ id: schema.passkeys.id, transports: schema.passkeys.transports })
    .from(schema.passkeys)
    .where(eq(schema.passkeys.userId, user.id));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: relyingParty(ctx).rpID,
    userName: user.username,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: existing,
    // Discoverable credentials let the sign-in page offer passkeys without typing a username.
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });

  return { challengeId: challenges.save(options.challenge, user.id), options };
}

export async function finishPasskeyRegistration(
  ctx: AppContext,
  challenges: ChallengeStore,
  user: User,
  input: PasskeyRegistrationInput,
): Promise<Result<PasskeyInfo, AuthError>> {
  const pending = challenges.take(input.challengeId);

  if (!pending || pending.userId !== user.id) {
    return err(AuthError.PasskeyFailed);
  }

  const { rpID, origin } = relyingParty(ctx);
  const verification = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: pending.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  }).catch(() => null);

  if (!verification?.verified) {
    return err(AuthError.PasskeyFailed);
  }

  const { credential, credentialBackedUp } = verification.registrationInfo;
  const passkey = {
    id: credential.id,
    userId: user.id,
    name: input.name ?? DEFAULT_PASSKEY_NAME,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
    isBackedUp: credentialBackedUp,
    createdAt: ctx.now(),
    lastUsedAt: null,
  };

  await ctx.db.insert(schema.passkeys).values(passkey);

  return ok(toPasskeyInfo(passkey));
}

export async function startPasskeyLogin(ctx: AppContext, challenges: ChallengeStore) {
  const options = await generateAuthenticationOptions({
    rpID: relyingParty(ctx).rpID,
    userVerification: 'preferred',
  });

  return { challengeId: challenges.save(options.challenge, null), options };
}

export async function finishPasskeyLogin(
  ctx: AppContext,
  challenges: ChallengeStore,
  input: PasskeyLoginInput,
): Promise<Result<User, AuthError>> {
  const pending = challenges.take(input.challengeId);

  if (!pending) {
    return err(AuthError.PasskeyFailed);
  }

  const [row] = await ctx.db
    .select({ passkey: schema.passkeys, user: schema.users })
    .from(schema.passkeys)
    .innerJoin(schema.users, eq(schema.users.id, schema.passkeys.userId))
    .where(eq(schema.passkeys.id, input.response.id));

  if (!row) {
    return err(AuthError.PasskeyFailed);
  }

  const { rpID, origin } = relyingParty(ctx);
  const verification = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: pending.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: row.passkey.id,
      publicKey: new Uint8Array(row.passkey.publicKey),
      counter: row.passkey.counter,
      transports: row.passkey.transports,
    },
  }).catch(() => null);

  if (!verification?.verified) {
    return err(AuthError.PasskeyFailed);
  }

  if (row.user.suspendedAt !== null) {
    return err(AuthError.AccountSuspended);
  }

  await ctx.db
    .update(schema.passkeys)
    .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: ctx.now() })
    .where(eq(schema.passkeys.id, row.passkey.id));

  // A passkey can only be added from a signed-in session, which already required a verified email.
  return ok(row.user);
}

function toPasskeyInfo(passkey: typeof schema.passkeys.$inferSelect): PasskeyInfo {
  return {
    id: passkey.id,
    name: passkey.name,
    createdAt: passkey.createdAt,
    lastUsedAt: passkey.lastUsedAt,
    isBackedUp: passkey.isBackedUp,
  };
}

export async function listPasskeys(ctx: AppContext, userId: string) {
  const rows = await ctx.db
    .select()
    .from(schema.passkeys)
    .where(eq(schema.passkeys.userId, userId))
    .orderBy(desc(schema.passkeys.createdAt));

  return rows.map(toPasskeyInfo);
}

export async function renamePasskey(ctx: AppContext, userId: string, id: string, name: string) {
  const updated = await ctx.db
    .update(schema.passkeys)
    .set({ name })
    .where(and(eq(schema.passkeys.userId, userId), eq(schema.passkeys.id, id)))
    .returning({ id: schema.passkeys.id });

  return updated.length > 0;
}

export async function deletePasskey(ctx: AppContext, userId: string, id: string) {
  const deleted = await ctx.db
    .delete(schema.passkeys)
    .where(and(eq(schema.passkeys.userId, userId), eq(schema.passkeys.id, id)))
    .returning({ id: schema.passkeys.id });

  return deleted.length > 0;
}
