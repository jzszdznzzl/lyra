import { create } from 'zustand';

import { usePlayerStore } from './player-store.ts';

interface SleepTimerState {
  // When the music stops; null without a timer.
  endsAt: number | null;
  start: (minutes: number) => void;
  /** Stops after the song playing now, instead of after a time. */
  startUntilTrackEnds: () => void;
  cancel: () => void;
}

const MINUTE_MS = 60_000;

export const SLEEP_MINUTES = [15, 30, 45, 60] as const;

let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Minutes left, rounded up, so the last minute shows as 1 rather than 0. */
export function minutesLeft(endsAt: number, now: number) {
  return Math.max(1, Math.ceil((endsAt - now) / MINUTE_MS));
}

export const useSleepTimer = create<SleepTimerState>()((set) => ({
  endsAt: null,
  start: (minutes) => {
    clearTimer();
    usePlayerStore.getState().setStopsAfterTrack(false);
    const duration = minutes * MINUTE_MS;
    set({ endsAt: Date.now() + duration });
    timer = setTimeout(() => {
      timer = null;
      set({ endsAt: null });
      usePlayerStore.getState().sleep();
    }, duration);
  },
  startUntilTrackEnds: () => {
    clearTimer();
    set({ endsAt: null });
    usePlayerStore.getState().setStopsAfterTrack(true);
  },
  cancel: () => {
    clearTimer();
    set({ endsAt: null });
    usePlayerStore.getState().setStopsAfterTrack(false);
  },
}));
