import { registerSW } from 'virtual:pwa-register';

import { PlaybackStatus, usePlayerStore } from '../features/player/player-store.ts';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

// Only audio playing on this device matters; mirroring another device's playback does not.
function isPlayingHere() {
  const { status, remote } = usePlayerStore.getState();

  return status === PlaybackStatus.Playing && remote === null;
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

      if (!isPlayingHere()) {
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
    onRegisteredSW: (_url, registration) => {
      if (!registration) {
        return;
      }

      // Installed apps stay open for days; look for new versions now and then.
      const check = () => void registration.update().catch(() => undefined);
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          check();
        }
      });
    },
  });
}
