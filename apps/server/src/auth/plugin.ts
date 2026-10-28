import { Elysia } from 'elysia';
import type { Cookie } from 'elysia';
import type { Server } from 'bun';

import { AuthError } from '@lyra/shared';

import { SESSION_COOKIE, SESSION_TTL_MS, findSession } from './sessions.ts';
import type { AppContext } from '../context.ts';
import type { ClientInfo } from './sessions.ts';

const UNKNOWN_IP = 'unknown';

export function clientInfo(request: Request, server: Server<unknown> | null): ClientInfo {
  // Behind the Cloudflare tunnel every socket comes from cloudflared; the real address is here.
  const forwarded = request.headers.get('cf-connecting-ip');

  return {
    userAgent: request.headers.get('user-agent') ?? '',
    ip: forwarded ?? server?.requestIP(request)?.address ?? UNKNOWN_IP,
  };
}

export function setSessionCookie(
  ctx: AppContext,
  cookie: Record<string, Cookie<unknown>>,
  token: string,
) {
  cookie[SESSION_COOKIE]?.set({
    value: token,
    httpOnly: true,
    secure: new URL(ctx.env.PUBLIC_URL).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(cookie: Record<string, Cookie<unknown>>) {
  cookie[SESSION_COOKIE]?.remove();
}

/** Adds the `isSignedIn` route option, which resolves `user` and `session` or answers 401. */
export function authPlugin(ctx: AppContext) {
  return new Elysia({ name: 'auth-plugin' }).macro({
    isSignedIn: {
      async resolve({ cookie, request, server, status }) {
        const token = cookie[SESSION_COOKIE]?.value;

        if (typeof token !== 'string' || token === '') {
          return status(401, { error: AuthError.Unauthorized });
        }

        const found = await findSession(ctx, token, clientInfo(request, server));

        if (!found) {
          return status(401, { error: AuthError.Unauthorized });
        }

        return { user: found.user, session: found.session };
      },
    },
  });
}
