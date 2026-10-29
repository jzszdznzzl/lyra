import { Elysia } from 'elysia';

import { PushSubscriptionInput, PushUnsubscribeInput } from '@lyra/shared';
import type { PushKey } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import { isPushEndpoint } from './push.ts';
import type { AppContext } from '../context.ts';
import type { PushService } from './push.ts';

const PushError = Object.freeze({
  Disabled: 'push_disabled',
  BadEndpoint: 'bad_endpoint',
} as const);

export function pushRoutes(ctx: AppContext, push: PushService) {
  return new Elysia({ prefix: '/push' })
    .use(authPlugin(ctx))
    .get('/key', (): PushKey => ({ publicKey: push.publicKey }), { isSignedIn: true })
    .post(
      '/subscriptions',
      async ({ user, body, status }) => {
        if (!push.publicKey) {
          return status(409, { error: PushError.Disabled });
        }

        if (!isPushEndpoint(body.endpoint)) {
          return status(422, { error: PushError.BadEndpoint });
        }

        await push.subscribe(user.id, body);

        return status(204);
      },
      { isSignedIn: true, body: PushSubscriptionInput },
    )
    .delete(
      '/subscriptions',
      async ({ user, body, status }) => {
        await push.unsubscribe(user.id, body.endpoint);

        return status(204);
      },
      { isSignedIn: true, body: PushUnsubscribeInput },
    );
}
