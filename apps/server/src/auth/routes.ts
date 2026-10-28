import { Elysia } from 'elysia';
import { z } from 'zod';

import {
  AuthError,
  EmailInput,
  LoginInput,
  PasskeyLoginInput,
  RegisterInput,
  ResetPasswordInput,
  TokenInput,
} from '@lyra/shared';

import { RateLimiter } from '../common/index.ts';
import { authErrorStatus } from '../http-errors.ts';
import { toUserProfile } from '../users/profile.ts';
import {
  login,
  register,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from './accounts.ts';
import { finishPasskeyLogin, startPasskeyLogin } from './passkeys.ts';
import { authPlugin, clearSessionCookie, clientInfo, setSessionCookie } from './plugin.ts';
import { createSession, revokeSession } from './sessions.ts';
import type { AppContext } from '../context.ts';
import type { ChallengeStore } from './passkeys.ts';

const MINUTE_MS = 60 * 1000;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * MINUTE_MS;
const MAIL_LIMIT = 5;
const MAIL_WINDOW_MS = 60 * MINUTE_MS;

export interface AuthRoutesOptions {
  challenges: ChallengeStore;
  isGoogleLinked: (userId: string) => Promise<boolean>;
}

export function authRoutes(ctx: AppContext, options: AuthRoutesOptions) {
  const loginLimiter = new RateLimiter(LOGIN_LIMIT, LOGIN_WINDOW_MS, ctx.now);
  const mailLimiter = new RateLimiter(MAIL_LIMIT, MAIL_WINDOW_MS, ctx.now);
  const { challenges, isGoogleLinked } = options;

  return new Elysia({ prefix: '/auth' })
    .use(authPlugin(ctx))
    .post(
      '/register',
      async ({ body, request, server, status }) => {
        if (!ctx.env.REGISTRATION_ENABLED) {
          return status(403, { error: AuthError.RegistrationClosed });
        }

        if (!mailLimiter.hit(`register:${clientInfo(ctx, request, server).ip}`)) {
          return status(429, { error: AuthError.TooManyRequests });
        }

        const result = await register(ctx, body);

        if (result.error) {
          return status(authErrorStatus(result.error), { error: result.error });
        }

        return status(201, { email: result.data.email });
      },
      { body: RegisterInput },
    )
    .post(
      '/verify-email',
      async ({ body, cookie, request, server, status }) => {
        const result = await verifyEmail(ctx, body.token);

        if (result.error) {
          return status(authErrorStatus(result.error), { error: result.error });
        }

        const { token } = await createSession(
          ctx,
          result.data.id,
          clientInfo(ctx, request, server),
        );
        setSessionCookie(ctx, cookie, token);

        return toUserProfile(result.data, await isGoogleLinked(result.data.id));
      },
      { body: TokenInput },
    )
    .post(
      '/resend-verification',
      async ({ body, request, server, status }) => {
        const ip = clientInfo(ctx, request, server).ip;

        if (!mailLimiter.hit(`resend:${ip}`) || !mailLimiter.hit(`resend:${body.email}`)) {
          return status(429, { error: AuthError.TooManyRequests });
        }

        await resendVerification(ctx, body.email);

        return status(204);
      },
      { body: EmailInput },
    )
    .post(
      '/login',
      async ({ body, cookie, request, server, status }) => {
        const client = clientInfo(ctx, request, server);

        if (!loginLimiter.hit(`login:${client.ip}`)) {
          return status(429, { error: AuthError.TooManyRequests });
        }

        const result = await login(ctx, body);

        if (result.error) {
          return status(authErrorStatus(result.error), { error: result.error });
        }

        const { token } = await createSession(ctx, result.data.id, client);
        setSessionCookie(ctx, cookie, token);

        return toUserProfile(result.data, await isGoogleLinked(result.data.id));
      },
      { body: LoginInput },
    )
    .post(
      '/logout',
      async ({ cookie, user, session, status }) => {
        await revokeSession(ctx, user.id, session.id);
        clearSessionCookie(cookie);

        return status(204);
      },
      { isSignedIn: true },
    )
    .post(
      '/forgot-password',
      async ({ body, request, server, status }) => {
        const ip = clientInfo(ctx, request, server).ip;

        if (!mailLimiter.hit(`forgot:${ip}`) || !mailLimiter.hit(`forgot:${body.email}`)) {
          return status(429, { error: AuthError.TooManyRequests });
        }

        await requestPasswordReset(ctx, body.email);

        return status(204);
      },
      { body: EmailInput },
    )
    .post(
      '/reset-password',
      async ({ body, status }) => {
        const result = await resetPassword(ctx, body);

        if (result.error) {
          return status(authErrorStatus(result.error), { error: result.error });
        }

        return status(204);
      },
      { body: ResetPasswordInput },
    )
    .post('/passkey/options', () => startPasskeyLogin(ctx, challenges), {
      body: z.object({}).optional(),
    })
    .post(
      '/passkey/verify',
      async ({ body, cookie, request, server, status }) => {
        const client = clientInfo(ctx, request, server);

        if (!loginLimiter.hit(`login:${client.ip}`)) {
          return status(429, { error: AuthError.TooManyRequests });
        }

        const result = await finishPasskeyLogin(ctx, challenges, body);

        if (result.error) {
          return status(authErrorStatus(result.error), { error: result.error });
        }

        const { token } = await createSession(ctx, result.data.id, client);
        setSessionCookie(ctx, cookie, token);

        return toUserProfile(result.data, await isGoogleLinked(result.data.id));
      },
      { body: PasskeyLoginInput },
    );
}
