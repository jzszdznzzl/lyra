import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';

import { PlaybackStatus, usePlayerStore } from '../features/player/player-store.ts';

interface UpdateState {
  // A new version is installed and waits for a pause (or for the user) to take over.
  isReady: boolean;
}

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export const useUpdateStore = create<UpdateState>()(() => ({ isReady: false }));

let switchVersion: (() => void) | null = null;
let registration: ServiceWorkerRegistration | null = null;
// Set when the user asks to update before the new version finished downloading.
let shouldSwitchWhenReady = false;

// Only audio playing on this device matters; mirroring another device's playback does not.
function isPlayingHere() {
  const { status, remote } = usePlayerStore.getState();

  return status === PlaybackStatus.Playing && remote === null;
}

/** Looks for a new version now; the service worker downloads it in the background. */
export async function checkForUpdate() {
  await registration?.update().catch(() => undefined);
}

/** Switches to the new version right away, even mid-song, because the user asked for it. */
export function applyUpdate() {
  if (switchVersion && useUpdateStore.getState().isReady) {
    switchVersion();

    return;
  }

  // Without a service worker (development, old browsers) a reload already loads the new files.
  if (!registration) {
    window.location.reload();

    return;
  }

  shouldSwitchWhenReady = true;
  void checkForUpdate();
}

/**
 * Installs new versions as soon as nothing is playing: right away when idle, otherwise at the
 * next pause. Switching versions reloads the page, which would cut a song short.
 */
export function startUpdates() {
  let isWaitingForPause = false;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      const apply = () => void updateSW(true);
      switchVersion = apply;
      useUpdateStore.setState({ isReady: true });

      if (shouldSwitchWhenReady || !isPlayingHere()) {
        apply();

        return;
      }

      if (isWaitingForPause) {
        return;
      }

      isWaitingForPause = true;
      const unsubscribe = usePlayerStore.subscribe(() => {
        if (!isPlayingHere()) {
          unsubscribe();
          apply();
        }
      });
    },
    onRegisteredSW: (_url, registered) => {
      if (!registered) {
        return;
      }

      registration = registered;

      // Installed apps stay open for days; look for new versions now and then.
      setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void checkForUpdate();
        }
      });
    },
  });
}
