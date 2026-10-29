import { eq, inArray } from 'drizzle-orm';
import webpush from 'web-push';
import type { PushSubscription, RequestOptions, SendResult } from 'web-push';

import { DEFAULT_LANGUAGE, Language } from '@lyra/shared';
import type { PushSubscriptionInput } from '@lyra/shared';

import { schema } from '../db/index.ts';
import { errorMessage, moduleLogger } from '../logger.ts';
import { pushMessage } from './messages.ts';
import type { AppContext } from '../context.ts';
import type { PushNotice } from './messages.ts';

export type PushSender = (
  subscription: PushSubscription,
  payload: string,
  options: RequestOptions,
) => Promise<SendResult>;

// Push services answer these for subscriptions that no longer exist.
const GONE_STATUSES = new Set([404, 410]);
// Browsers make a new subscription now and then; old ones are dropped past this.
const MAX_SUBSCRIPTIONS_PER_USER = 10;
// A friend request is still worth showing a day later; older ones are dropped by the service.
const TIME_TO_LIVE_SECONDS = 24 * 60 * 60;
/**
 * The push services of Chrome, Firefox, Safari and Edge. The server posts to whatever endpoint a
 * browser hands over, so anything else is refused: it could point at an internal address.
 */
const PUSH_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  '.push.apple.com',
  '.notify.windows.com',
];

const log = moduleLogger('push');

function statusOf(error: unknown) {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number(error.statusCode)
    : null;
}

export function isPushEndpoint(endpoint: string) {
  const url = URL.parse(endpoint);

  if (!url || url.protocol !== 'https:') {
    return false;
  }

  return PUSH_HOSTS.some((host) =>
    host.startsWith('.') ? url.hostname.endsWith(host) : url.hostname === host,
  );
}

/** Sends notifications to every device where a user turned them on. */
export class PushService {
  #ctx: AppContext;
  #send: PushSender;

  constructor(ctx: AppContext, send: PushSender = webpush.sendNotification) {
    this.#ctx = ctx;
    this.#send = send;
  }

  get publicKey() {
    return this.#ctx.env.VAPID_PUBLIC_KEY ?? null;
  }

  async subscribe(userId: string, input: PushSubscriptionInput) {
    const row = {
      endpoint: input.endpoint,
      userId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      createdAt: this.#ctx.now(),
    };

    await this.#ctx.db
      .insert(schema.pushSubscriptions)
      .values(row)
      .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: row });

    const mine = await this.#ctx.db
      .select({ endpoint: schema.pushSubscriptions.endpoint })
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId))
      .orderBy(schema.pushSubscriptions.createdAt);
    const extra = mine.slice(0, Math.max(0, mine.length - MAX_SUBSCRIPTIONS_PER_USER));

    if (extra.length > 0) {
      await this.#remove(extra.map((subscription) => subscription.endpoint));
    }
  }

  async unsubscribe(userId: string, endpoint: string) {
    const [row] = await this.#ctx.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, endpoint));

    if (row?.userId === userId) {
      await this.#remove([endpoint]);
    }
  }

  async #remove(endpoints: string[]) {
    await this.#ctx.db
      .delete(schema.pushSubscriptions)
      .where(inArray(schema.pushSubscriptions.endpoint, endpoints));
  }

  /** Never throws: a notification that does not arrive must not break what triggered it. */
  async notify(userId: string, notice: PushNotice) {
    const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = this.#ctx.env;

    if (!publicKey || !privateKey) {
      return;
    }

    try {
      const [user] = await this.#ctx.db
        .select({ language: schema.users.language })
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      const language =
        Object.values(Language).find((value) => value === user?.language) ?? DEFAULT_LANGUAGE;
      const payload = JSON.stringify(pushMessage(notice, language));
      const subscriptions = await this.#ctx.db
        .select()
        .from(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.userId, userId));
      const gone: string[] = [];

      await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await this.#send(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              payload,
              {
                TTL: TIME_TO_LIVE_SECONDS,
                vapidDetails: { subject: this.#ctx.env.PUBLIC_URL, publicKey, privateKey },
              },
            );
          } catch (error) {
            if (GONE_STATUSES.has(statusOf(error) ?? 0)) {
              gone.push(subscription.endpoint);
            } else {
              log.warn(`send: ${errorMessage(error)}`);
            }
          }
        }),
      );

      if (gone.length > 0) {
        await this.#remove(gone);
      }
    } catch (error) {
      log.warn(`notify: ${errorMessage(error)}`);
    }
  }
}
