import { Elysia } from 'elysia';

import { BrowserClientMessage, CookieLinkInput, GoogleError, GoogleLinkMethod } from '@lyra/shared';
import type { BrowserServerMessage, GoogleError as GoogleErrorType } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { getGoogleAccount, saveGoogleAccount, unlinkGoogleAccount } from './accounts.ts';
import { GOOGLE_LOGIN_TARGET, RemoteLogin } from './remote-login.ts';
import { verifyGoogleCookie } from './verify-cookie.ts';
import { errorMessage, moduleLogger } from '../logger.ts';
import type { AppContext } from '../context.ts';
import type { ImageRegistry } from '../images/registry.ts';
import type { InnertubePool } from '../ytmusic/innertube.ts';
import type { RemoteLoginTarget } from './remote-login.ts';

const GOOGLE_ERROR_STATUS = {
  [GoogleError.InvalidCookies]: 422,
  [GoogleError.NotSignedIn]: 422,
  [GoogleError.BrowserUnavailable]: 503,
  [GoogleError.BrowserBusy]: 409,
} as const satisfies Record<GoogleErrorType, number>;

export interface GoogleRoutesOptions {
  pool: InnertubePool;
  images: ImageRegistry;
  // Tests point the remote browser at a local fake instead of Google.
  loginTarget?: RemoteLoginTarget;
}

const log = moduleLogger('google');

export function googleRoutes(
  ctx: AppContext,
  { pool, images, loginTarget = GOOGLE_LOGIN_TARGET }: GoogleRoutesOptions,
) {
  const sessions = new Map<string, RemoteLogin>();
  // Sockets whose browser is still starting; one that closes meanwhile is removed from here.
  const starting = new Set<string>();

  return new Elysia({ prefix: '/google' })
    .use(authPlugin(ctx))
    .onAfterHandle(async ({ responseValue }) => {
      await images.rewrite(responseValue);
    })
    .get('/', async ({ user }) => ({ account: await getGoogleAccount(ctx, user.id) }), {
      isSignedIn: true,
    })
    .post(
      '/cookies',
      async ({ body, user, status }) => {
        const verified = await verifyGoogleCookie(body.cookie);

        if (verified.error) {
          return status(GOOGLE_ERROR_STATUS[verified.error], { error: verified.error });
        }

        const account = await saveGoogleAccount(
          ctx,
          user.id,
          body.cookie,
          GoogleLinkMethod.Cookies,
          verified.data,
        );
        pool.forget(user.id);

        return { account };
      },
      { isSignedIn: true, body: CookieLinkInput },
    )
    .delete(
      '/',
      async ({ user, status }) => {
        await unlinkGoogleAccount(ctx, user.id);
        pool.forget(user.id);

        return status(204);
      },
      { isSignedIn: true },
    )
    .ws('/browser', {
      isSignedIn: true,
      async open(ws) {
        const { user } = ws.data;
        const send = (message: BrowserServerMessage) => {
          ws.send(message);
        };

        starting.add(ws.id);
        const session = await RemoteLogin.start(
          user.id,
          loginTarget,
          {
            onFrame: (data) => send({ type: 'frame', data }),
            onCookie: (cookie) => {
              void (async () => {
                const verified = await verifyGoogleCookie(cookie);

                if (verified.error) {
                  send({ type: 'error', error: verified.error });
                } else {
                  const account = await saveGoogleAccount(
                    ctx,
                    user.id,
                    cookie,
                    GoogleLinkMethod.Browser,
                    verified.data,
                  );
                  pool.forget(user.id);
                  await images.rewrite(account);
                  send({ type: 'linked', account });
                }

                ws.close();
              })();
            },
            onClosed: () => {
              sessions.delete(ws.id);
            },
          },
          ctx.env.BROWSER_EXECUTABLE,
        ).catch((error: unknown) => {
          log.warn({ err: error }, `remote browser failed: ${errorMessage(error)}`);

          return undefined;
        });
        const isStillOpen = starting.delete(ws.id);

        if (session && !isStillOpen) {
          await session.close();

          return;
        }

        if (session === null) {
          send({ type: 'error', error: GoogleError.BrowserBusy });
          ws.close();

          return;
        }

        if (session === undefined) {
          send({ type: 'error', error: GoogleError.BrowserUnavailable });
          ws.close();

          return;
        }

        sessions.set(ws.id, session);
      },
      async message(ws, message) {
        const parsed = BrowserClientMessage.safeParse(message);

        if (parsed.success) {
          await sessions
            .get(ws.id)
            ?.handle(parsed.data)
            .catch(() => undefined);
        }
      },
      async close(ws) {
        if (!starting.delete(ws.id)) {
          await sessions.get(ws.id)?.close();
        }
      },
    });
}
