import { z } from 'zod';

export const MAX_PUSH_ENDPOINT_LENGTH = 2048;

/** What the browser's PushSubscription.toJSON() gives, as the server stores it. */
export const PushSubscriptionInput = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(MAX_PUSH_ENDPOINT_LENGTH),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInput>;

export const PushUnsubscribeInput = z.object({
  endpoint: z.string().min(1).max(MAX_PUSH_ENDPOINT_LENGTH),
});

export type PushUnsubscribeInput = z.infer<typeof PushUnsubscribeInput>;

/** The server's VAPID public key; null when this server has no keys and push is off. */
export const PushKey = z.object({ publicKey: z.string().nullable() });

export type PushKey = z.infer<typeof PushKey>;

/** The payload of every push, read by the service worker. */
export const PushMessage = z.object({
  title: z.string(),
  body: z.string(),
  // A path inside Lyra, opened when the notification is tapped.
  url: z.string().startsWith('/'),
  // Notifications with the same tag replace each other instead of piling up.
  tag: z.string(),
});

export type PushMessage = z.infer<typeof PushMessage>;
