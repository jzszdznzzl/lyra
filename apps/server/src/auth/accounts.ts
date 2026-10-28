import { eq, or } from 'drizzle-orm';

import { AuthError, DEFAULT_LANGUAGE, Language, err, ok } from '@lyra/shared';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  Result,
} from '@lyra/shared';

import { schema } from '../db/index.ts';
import { resetPasswordMail, verifyEmailMail } from '../mail/index.ts';
import { isAllowedEmail } from './email-policy.ts';
import {
  EmailTokenPurpose,
  consumeEmailToken,
  issueEmailToken,
  peekEmailToken,
} from './email-tokens.ts';
import {
  burnPasswordCheck,
  hashPassword,
  isStrongPassword,
  verifyPassword,
} from './password-policy.ts';
import { revokeAllSessions } from './sessions.ts';
import type { AppContext } from '../context.ts';
import type { User } from './sessions.ts';

function toLanguage(value: string): Language {
  return Object.values(Language).find((language) => language === value) ?? DEFAULT_LANGUAGE;
}

function appUrl(ctx: AppContext, path: string, token: string) {
  const url = new URL(path, ctx.env.PUBLIC_URL);
  url.searchParams.set('token', token);

  return url.toString();
}

async function sendVerification(ctx: AppContext, user: User) {
  const token = await issueEmailToken(ctx, user.id, EmailTokenPurpose.VerifyEmail);
  const url = appUrl(ctx, '/verify-email', token);

  await ctx.mailer.send(verifyEmailMail(user.email, user.name, toLanguage(user.language), url));
}

export async function register(
  ctx: AppContext,
  input: RegisterInput,
): Promise<Result<User, AuthError>> {
  if (!isAllowedEmail(input.email)) {
    return err(AuthError.DisposableEmail);
  }

  if (!isStrongPassword(input.password, [input.email, input.username, input.name])) {
    return err(AuthError.WeakPassword);
  }

  const [existing] = await ctx.db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(or(eq(schema.users.email, input.email), eq(schema.users.username, input.username)));

  if (existing) {
    return err(existing.email === input.email ? AuthError.EmailTaken : AuthError.UsernameTaken);
  }

  const user: User = {
    id: Bun.randomUUIDv7(),
    email: input.email,
    username: input.username,
    name: input.name,
    passwordHash: await hashPassword(input.password),
    language: input.language ?? DEFAULT_LANGUAGE,
    avatarVersion: null,
    emailVerifiedAt: null,
    isYoutubeHistoryEnabled: true,
    isNowPlayingPublic: false,
    suspendedAt: null,
    lastActiveAt: null,
    createdAt: ctx.now(),
  };

  await ctx.db.insert(schema.users).values(user);
  await sendVerification(ctx, user);

  return ok(user);
}

export async function verifyEmail(
  ctx: AppContext,
  token: string,
): Promise<Result<User, AuthError>> {
  const userId = await consumeEmailToken(ctx, token, EmailTokenPurpose.VerifyEmail);

  if (!userId) {
    return err(AuthError.InvalidToken);
  }

  const [user] = await ctx.db
    .update(schema.users)
    .set({ emailVerifiedAt: ctx.now() })
    .where(eq(schema.users.id, userId))
    .returning();

  return user ? ok(user) : err(AuthError.InvalidToken);
}

/** Silently does nothing for unknown or verified emails, so it cannot reveal who has an account. */
export async function resendVerification(ctx: AppContext, email: string) {
  const [user] = await ctx.db.select().from(schema.users).where(eq(schema.users.email, email));

  if (user && user.emailVerifiedAt === null) {
    await sendVerification(ctx, user);
  }
}

export async function login(ctx: AppContext, input: LoginInput): Promise<Result<User, AuthError>> {
  const [user] = await ctx.db
    .select()
    .from(schema.users)
    .where(
      or(eq(schema.users.email, input.identifier), eq(schema.users.username, input.identifier)),
    );

  if (!user) {
    await burnPasswordCheck(input.password);

    return err(AuthError.InvalidCredentials);
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    return err(AuthError.InvalidCredentials);
  }

  if (user.emailVerifiedAt === null) {
    return err(AuthError.EmailNotVerified);
  }

  if (user.suspendedAt !== null) {
    return err(AuthError.AccountSuspended);
  }

  return ok(user);
}

export async function requestPasswordReset(ctx: AppContext, email: string) {
  const [user] = await ctx.db.select().from(schema.users).where(eq(schema.users.email, email));

  if (!user) {
    return;
  }

  const token = await issueEmailToken(ctx, user.id, EmailTokenPurpose.ResetPassword);
  const url = appUrl(ctx, '/reset-password', token);

  await ctx.mailer.send(resetPasswordMail(user.email, user.name, toLanguage(user.language), url));
}

export async function resetPassword(
  ctx: AppContext,
  input: ResetPasswordInput,
): Promise<Result<null, AuthError>> {
  const userId = await peekEmailToken(ctx, input.token, EmailTokenPurpose.ResetPassword);
  const [user] = userId
    ? await ctx.db.select().from(schema.users).where(eq(schema.users.id, userId))
    : [];

  if (!user) {
    return err(AuthError.InvalidToken);
  }

  // Checked before consuming the token, so a weak password does not burn the link.
  if (!isStrongPassword(input.password, [user.email, user.username, user.name])) {
    return err(AuthError.WeakPassword);
  }

  if (!(await consumeEmailToken(ctx, input.token, EmailTokenPurpose.ResetPassword))) {
    return err(AuthError.InvalidToken);
  }

  await ctx.db
    .update(schema.users)
    // Following a reset link proves the mailbox, so it also verifies the email.
    .set({
      passwordHash: await hashPassword(input.password),
      emailVerifiedAt: user.emailVerifiedAt ?? ctx.now(),
    })
    .where(eq(schema.users.id, user.id));
  await revokeAllSessions(ctx, user.id);

  return ok(null);
}

export async function changePassword(
  ctx: AppContext,
  user: User,
  input: ChangePasswordInput,
): Promise<Result<null, AuthError>> {
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    return err(AuthError.InvalidCredentials);
  }

  if (!isStrongPassword(input.newPassword, [user.email, user.username, user.name])) {
    return err(AuthError.WeakPassword);
  }

  await ctx.db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(input.newPassword) })
    .where(eq(schema.users.id, user.id));

  return ok(null);
}
