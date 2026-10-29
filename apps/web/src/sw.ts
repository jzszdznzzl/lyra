/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import type { PrecacheEntry } from 'workbox-precaching';

import { PushMessage } from '@lyra/shared';

import { AUDIO_CACHE, IMAGE_CACHE, offlineAudioKey } from './offline/keys.ts';
import type { OpenPathMessage } from './sw-messages.ts';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] };

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;
const NOTIFICATION_ICON = '/icons/icon-192.png';
const IMAGE_MAX_ENTRIES = 3000;

/** Answers a range request from a whole cached file, as <audio> needs to seek. */
async function rangeResponse(cached: Response, rangeHeader: string | null) {
  const blob = await cached.blob();
  const type = cached.headers.get('content-type') ?? 'audio/webm';
  const match = rangeHeader ? RANGE_PATTERN.exec(rangeHeader) : null;

  if (!match) {
    return new Response(blob, {
      headers: {
        'content-type': type,
        'content-length': String(blob.size),
        'accept-ranges': 'bytes',
      },
    });
  }

  const [, from = '', to = ''] = match;
  const start = from === '' ? Math.max(0, blob.size - Number(to)) : Number(from);
  const end = from !== '' && to !== '' ? Math.min(Number(to), blob.size - 1) : blob.size - 1;

  if (start > end || start >= blob.size) {
    return new Response(null, {
      status: 416,
      headers: { 'content-range': `bytes */${blob.size}` },
    });
  }

  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'content-type': type,
      'content-length': String(end - start + 1),
      'content-range': `bytes ${start}-${end}/${blob.size}`,
      'accept-ranges': 'bytes',
    },
  });
}

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Client-side routes load the app shell, also offline.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }),
);

/** Keeps the newest `max` entries; Cache Storage lists keys in insertion order. */
async function trimCache(cache: Cache, max: number) {
  const keys = await cache.keys();

  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

// Covers rarely change and make the offline library recognisable: cache first, capped in size.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/images/'),
  async ({ request }) => {
    const cache = await caches.open(IMAGE_CACHE);
    const hit = await cache.match(request);

    if (hit) {
      return hit;
    }

    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
      void trimCache(cache, IMAGE_MAX_ENTRIES);
    }

    return response;
  },
);

// Downloaded songs play from the device, online or not, saving data either way.
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/api/stream/') &&
    (url.searchParams.get('type') ?? 'audio') === 'audio',
  async ({ url, request }) => {
    const videoId = decodeURIComponent(url.pathname.slice('/api/stream/'.length));
    const cached = await (await caches.open(AUDIO_CACHE)).match(offlineAudioKey(videoId));

    return cached ? rangeResponse(cached, request.headers.get('range')) : fetch(request);
  },
);

const SkipWaitingMessage = { type: 'SKIP_WAITING' } as const;

// registerSW (autoUpdate) sends this to a waiting worker; activating it reloads the open pages
// onto the new version. Without it, updates waited until every tab and the app were closed.
self.addEventListener('message', (event) => {
  const data: unknown = event.data;

  if (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === SkipWaitingMessage.type
  ) {
    void self.skipWaiting();
  }
});

// Friend requests and playlist invitations, sent by the server (push/push.ts).
self.addEventListener('push', (event) => {
  const parsed = PushMessage.safeParse(event.data?.json());

  if (!parsed.success) {
    return;
  }

  const { title, body, url, tag } = parsed.data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      data: { url },
    }),
  );
});

/**
 * Shows the notification's page. An open app changes page itself: reloading it would stop the
 * music. Otherwise the app opens on that page.
 */
async function openFromNotification(url: string) {
  const windows = await self.clients.matchAll({ type: 'window' });
  const open = windows[0];

  if (open) {
    await open.focus();
    open.postMessage({ type: 'open-path', path: url } satisfies OpenPathMessage);

    return;
  }

  await self.clients.openWindow(url);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data: unknown = event.notification.data;
  const url =
    typeof data === 'object' &&
    data !== null &&
    'url' in data &&
    typeof data.url === 'string' &&
    data.url.startsWith('/')
      ? data.url
      : '/';

  event.waitUntil(openFromNotification(url));
});
