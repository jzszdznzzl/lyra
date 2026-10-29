import { PushKey, PushSubscriptionInput } from '@lyra/shared';

import { NoContent, api } from '../../lib/api.ts';

export const PushSupport = Object.freeze({
  Ready: 'ready',
  // This browser has no Web Push at all.
  Unsupported: 'unsupported',
  // iPhone and iPad only allow it for apps added to the home screen.
  NeedsInstall: 'needs_install',
  // The person said no; only the browser's site settings can undo that.
  Denied: 'denied',
  // This server has no VAPID keys.
  Off: 'off',
} as const);

export type PushSupport = (typeof PushSupport)[keyof typeof PushSupport];

const IOS_DEVICE = /iPhone|iPad|iPod/;

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

/** VAPID keys come base64url-encoded; the Push API wants the raw bytes. */
function keyBytes(base64Url: string) {
  const base64 = base64Url.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function registration() {
  // getRegistration, not ready: without a worker (development) ready never settles.
  return (await navigator.serviceWorker?.getRegistration()) ?? null;
}

async function save(subscription: PushSubscription) {
  const input = PushSubscriptionInput.safeParse(subscription.toJSON());

  return input.success ? api('POST', '/push/subscriptions', NoContent, input.data) : null;
}

export async function pushSupport(): Promise<PushSupport> {
  if (IOS_DEVICE.test(navigator.userAgent) && !isInstalled()) {
    return PushSupport.NeedsInstall;
  }

  if (!('PushManager' in window) || !('Notification' in window) || !(await registration())) {
    return PushSupport.Unsupported;
  }

  if (Notification.permission === 'denied') {
    return PushSupport.Denied;
  }

  const key = await api('GET', '/push/key', PushKey);

  return key.data?.publicKey ? PushSupport.Ready : PushSupport.Off;
}

export async function currentSubscription() {
  return (await (await registration())?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission (it must follow a tap) and registers this device with the server. */
export async function enablePush() {
  const key = await api('GET', '/push/key', PushKey);
  const worker = await registration();

  if (!key.data?.publicKey || !worker || (await Notification.requestPermission()) !== 'granted') {
    return false;
  }

  const subscription = await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(key.data.publicKey),
  });
  const saved = await save(subscription);

  return saved?.error === null;
}

export async function disablePush() {
  const subscription = await currentSubscription();

  if (!subscription) {
    return;
  }

  await api('DELETE', '/push/subscriptions', NoContent, { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

/** Browsers renew subscriptions now and then; sending it on every start keeps the server current. */
export async function syncPushSubscription() {
  const subscription = await currentSubscription();

  if (subscription && Notification.permission === 'granted') {
    await save(subscription);
  }
}
