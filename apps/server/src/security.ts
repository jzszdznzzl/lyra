import { Elysia } from 'elysia';

import { clientInfo } from './auth/plugin.ts';
import { RateLimiter } from './common/index.ts';
import { SESSION_COOKIE } from './auth/sessions.ts';
import type { AppContext } from './context.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MINUTE_MS = 60 * 1000;
const HSTS_MAX_AGE = 60 * 60 * 24 * 365;

export const FORBIDDEN_ORIGIN = 'forbidden_origin';

/**
 * Applied to every response: no MIME sniffing, no framing (clickjacking), no stray browser
 * features, and HSTS when served over HTTPS.
 */
export function securityHeaders(ctx: AppContext) {
  const isHttps = new URL(ctx.env.PUBLIC_URL).protocol === 'https:';

  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'cross-origin-opener-policy': 'same-origin',
    ...(isHttps
      ? { 'strict-transport-security': `max-age=${HSTS_MAX_AGE}; includeSubDomains` }
      : {}),
  };
}

/** Policy for the app's HTML: only its own scripts, the Google font, and same-origin data. */
export function contentSecurityPolicy(publicUrl: string) {
  const { host, protocol } = new URL(publicUrl);
  const socket = `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`;

  return [
    "default-src 'self'",
    "script-src 'self'",
    // React sets `style` attributes (cover colours, progress bars).
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    `connect-src 'self' ${socket}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Browsers always send Origin on writes and WebSocket upgrades. Refusing any other origin stops
 * other sites from acting with the user's cookie (CSRF) or opening sockets in their name.
 */
export function originGuard(ctx: AppContext) {
  const expected = new URL(ctx.env.PUBLIC_URL).origin;
  const headers = securityHeaders(ctx);

  return new Elysia({ name: 'origin-guard' }).onRequest(({ request, set, status }) => {
    Object.assign(set.headers, headers);

    const isUpgrade = request.headers.get('upgrade')?.toLowerCase() === 'websocket';

    if (
      (isUpgrade || !SAFE_METHODS.has(request.method)) &&
      request.headers.get('origin') !== expected
    ) {
      return status(403, { error: FORBIDDEN_ORIGIN });
    }

    return undefined;
  });
}

/** Per-session request budget for a group of routes (falls back to the IP when signed out). */
export function sessionRateLimit(ctx: AppContext, name: string, perMinute: number) {
  const limiter = new RateLimiter(perMinute, MINUTE_MS, ctx.now);

  return new Elysia({ name: `rate-limit-${name}` }).onBeforeHandle(
    { as: 'scoped' },
    ({ cookie, request, server, status }) => {
      const session = cookie[SESSION_COOKIE]?.value;
      const key =
        typeof session === 'string' && session !== ''
          ? `s:${session}`
          : `ip:${clientInfo(ctx, request, server).ip}`;

      return limiter.hit(key) ? undefined : status(429, { error: 'too_many_requests' });
    },
  );
}
