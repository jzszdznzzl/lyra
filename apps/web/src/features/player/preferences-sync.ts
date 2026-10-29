import { z } from 'zod';

import { ListeningPreferences, SyncedPreferences } from '@lyra/shared';

import { ApiError, api } from '../../lib/api.ts';
import { useConnectStore } from '../connect/connect-store.ts';
import { usePlayerStore } from './player-store.ts';
import { pickPreferences } from './settings.ts';

const SavedPreferences = z.object({ preferences: ListeningPreferences, updatedAt: z.number() });

/** Where this device stands with the account's copy, kept per account in localStorage. */
export const SyncState = z.object({
  // Server time of the account copy this device last matched; null before the first sync.
  syncedAt: z.number().nullable().catch(null),
  // Changed here and not saved yet (offline, or a save still on its way).
  isDirty: z.boolean().catch(false),
});

export type SyncState = z.infer<typeof SyncState>;

export const SyncAction = Object.freeze({
  Upload: 'upload',
  Apply: 'apply',
  Keep: 'keep',
} as const);

export type SyncAction = (typeof SyncAction)[keyof typeof SyncAction];

const STORAGE_PREFIX = 'lyra.preferences-sync.';
// Sliders report every step; one save shortly after they stop is enough.
const SAVE_DELAY_MS = 600;
// A save that failed (network cut, server busy) is tried again after this.
const RETRY_MS = 10_000;

const isSame = (a: ListeningPreferences, b: ListeningPreferences) =>
  JSON.stringify(a) === JSON.stringify(b);

function loadState(key: string): SyncState {
  try {
    return SyncState.parse(JSON.parse(localStorage.getItem(key) ?? '{}'));
  } catch {
    return SyncState.parse({});
  }
}

function saveState(key: string, state: SyncState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage can be blocked; the sync still works until the tab closes.
  }
}

/**
 * What to do with the account's copy after (re)connecting. A change made here while offline is
 * the newest one the person made, so it wins; otherwise a newer account copy replaces ours.
 */
export function resolvePull(state: SyncState, remote: SyncedPreferences): SyncAction {
  if (remote.preferences === null || remote.updatedAt === null || state.isDirty) {
    return SyncAction.Upload;
  }

  if (state.syncedAt === null || remote.updatedAt > state.syncedAt) {
    return SyncAction.Apply;
  }

  return SyncAction.Keep;
}

/** A save from another device applies unless this one has its own change on the way. */
export function shouldApplyIncoming(state: SyncState, updatedAt: number) {
  return !state.isDirty && (state.syncedAt === null || updatedAt > state.syncedAt);
}

/**
 * Keeps the listening preferences of this device and the account in step: local changes are
 * saved, and saves from other devices (pushed over Connect) apply at once.
 */
export function startPreferencesSync(userId: string) {
  const key = `${STORAGE_PREFIX}${userId}`;
  let state = loadState(key);
  let isApplying = false;
  let isStopped = false;
  let isSaving = false;
  let hasQueuedSave = false;
  let version = 0;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function setState(next: SyncState) {
    state = next;
    saveState(key, next);
  }

  function apply(preferences: ListeningPreferences, updatedAt: number) {
    isApplying = true;

    try {
      usePlayerStore.getState().updateSettings(preferences);
    } finally {
      isApplying = false;
    }

    setState({ syncedAt: updatedAt, isDirty: false });
  }

  async function upload() {
    saveTimer = null;

    // One save at a time, so the server never gets them out of order.
    if (isSaving) {
      hasQueuedSave = true;

      return;
    }

    isSaving = true;
    const sent = version;
    const preferences = pickPreferences(usePlayerStore.getState().settings);
    const result = await api('PUT', '/me/preferences', SavedPreferences, preferences);
    isSaving = false;

    if (isStopped) {
      return;
    }

    if (result.error === null) {
      setState({ syncedAt: result.data.updatedAt, isDirty: version !== sent });
    } else if (result.error !== ApiError.Validation && !hasQueuedSave) {
      // It stays pending; also retried on reconnection and when the network comes back.
      scheduleUpload(RETRY_MS);
    }

    if (hasQueuedSave) {
      hasQueuedSave = false;
      await upload();
    }
  }

  function scheduleUpload(delayMs = SAVE_DELAY_MS) {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      upload().catch(() => undefined);
    }, delayMs);
  }

  function onOnline() {
    if (state.isDirty) {
      scheduleUpload();
    }
  }

  async function pull() {
    const result = await api('GET', '/me/preferences', SyncedPreferences);

    if (isStopped || result.error !== null) {
      return;
    }

    const remote = result.data;

    switch (resolvePull(state, remote)) {
      case SyncAction.Upload: {
        await upload();
        break;
      }
      case SyncAction.Apply: {
        if (remote.preferences && remote.updatedAt !== null) {
          apply(remote.preferences, remote.updatedAt);
        }

        break;
      }
      default: {
        break;
      }
    }
  }

  const unsubscribePlayer = usePlayerStore.subscribe((next, previous) => {
    if (isApplying || next.settings === previous.settings) {
      return;
    }

    if (isSame(pickPreferences(next.settings), pickPreferences(previous.settings))) {
      return;
    }

    version += 1;
    setState({ ...state, isDirty: true });
    scheduleUpload();
  });

  // Saves made elsewhere while this device was away are fetched on every (re)connection.
  const unsubscribeConnect = useConnectStore.subscribe((next, previous) => {
    if (next.isConnected && !previous.isConnected) {
      pull().catch(() => undefined);
    }
  });

  if (useConnectStore.getState().isConnected) {
    pull().catch(() => undefined);
  }

  // The Connect socket can survive a short network cut, so it is not the only signal.
  window.addEventListener('online', onOnline);

  return {
    receive: (preferences: ListeningPreferences, updatedAt: number) => {
      if (!isStopped && shouldApplyIncoming(state, updatedAt)) {
        apply(preferences, updatedAt);
      }
    },
    stop: () => {
      isStopped = true;

      if (saveTimer) {
        clearTimeout(saveTimer);
      }

      window.removeEventListener('online', onOnline);
      unsubscribePlayer();
      unsubscribeConnect();
    },
  };
}
