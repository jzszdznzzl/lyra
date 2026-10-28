import { create } from 'zustand';

import { UpNext } from '@lyra/shared';
import type { Track } from '@lyra/shared';

import { AudioEngine } from '../../audio/engine.ts';
import {
  RepeatMode,
  insertNext,
  moveItem,
  nextIndex,
  previousIndex,
  removeAt,
  shuffleQueue,
} from '../../audio/queue.ts';
import { api } from '../../lib/api.ts';
import { loadSettings, saveSettings } from './settings.ts';
import type { PlayerSettings } from './settings.ts';

export const PlaybackStatus = Object.freeze({
  Idle: 'idle',
  Loading: 'loading',
  Playing: 'playing',
  Paused: 'paused',
} as const);

export type PlaybackStatus = (typeof PlaybackStatus)[keyof typeof PlaybackStatus];

interface PlayerState {
  queue: Track[];
  index: number;
  // The order before shuffling, so turning shuffle off restores it.
  unshuffled: Track[] | null;
  repeat: RepeatMode;
  status: PlaybackStatus;
  position: number;
  duration: number;
  settings: PlayerSettings;
  playTracks: (tracks: Track[], startIndex: number) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  jumpTo: (index: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (tracks: Track[]) => void;
  playNext: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  updateSettings: (patch: Partial<PlayerSettings>) => void;
}

// Restarting the song is friendlier than going back once a few seconds have played.
const RESTART_THRESHOLD_SECONDS = 3;
const REPEAT_ORDER = [RepeatMode.Off, RepeatMode.All, RepeatMode.One] as const;

export function streamUrl(track: Track, settings: PlayerSettings) {
  return `/api/stream/${encodeURIComponent(track.id)}?quality=${settings.quality}`;
}

export const usePlayerStore = create<PlayerState>()((set, get) => {
  let isCrossfading = false;
  let isFetchingRadio = false;

  const engine = new AudioEngine({
    onTime: (position, duration) => {
      set({ position, duration });
      maybeCrossfade(position, duration);
    },
    onEnded: () => {
      advance(false, false);
    },
    onError: () => {
      // A song YouTube refuses should not stop the whole queue.
      advance(false, false);
    },
    onPlayingChange: (isPlaying) => {
      set({ status: isPlaying ? PlaybackStatus.Playing : PlaybackStatus.Paused });
    },
  });

  const initial = loadSettings();
  engine.setVolume(initial.volume);
  engine.setEqualizer(initial.isEqEnabled, initial.eqGains);

  function start(index: number, startAt = 0, shouldPlay = true) {
    const { queue, settings } = get();
    const track = queue[index];

    if (!track) {
      return;
    }

    isCrossfading = false;
    set({
      index,
      position: startAt,
      duration: track.durationSeconds ?? 0,
      status: PlaybackStatus.Loading,
    });
    engine.load(streamUrl(track, settings), startAt, shouldPlay, settings.fadeMs).catch(() => {
      // Autoplay can be blocked until the user interacts; the play button recovers.
      set({ status: PlaybackStatus.Paused });
    });
    void topUpRadio();
  }

  /** Like YT Music: when the queue runs out, keep going with the last song's radio. */
  async function topUpRadio() {
    const { queue, index, settings, repeat } = get();
    const last = queue.at(-1);

    if (!settings.isAutoplayEnabled || repeat !== RepeatMode.Off || isFetchingRadio || !last) {
      return;
    }

    if (queue.length - index > 2) {
      return;
    }

    isFetchingRadio = true;
    const result = await api('GET', `/music/up-next/${encodeURIComponent(last.id)}`, UpNext);
    isFetchingRadio = false;

    if (result.data) {
      const known = new Set(get().queue.map((track) => track.id));
      const fresh = result.data.tracks.filter((track) => !known.has(track.id));
      set({ queue: [...get().queue, ...fresh] });
    }
  }

  function advance(isUserAction: boolean, withCrossfade: boolean) {
    const { queue, index, repeat, settings } = get();
    const target = nextIndex({ queue, index }, repeat, isUserAction);

    if (target === null) {
      engine.pause(0);
      set({ status: PlaybackStatus.Paused });

      return;
    }

    const track = queue[target];

    if (withCrossfade && track && target !== index) {
      isCrossfading = true;
      set({ index: target, position: 0, duration: track.durationSeconds ?? 0 });
      engine
        .crossfade(streamUrl(track, settings), settings.crossfadeSeconds)
        .catch(() => undefined);
      void topUpRadio();

      return;
    }

    start(target);
  }

  function maybeCrossfade(position: number, duration: number) {
    const { settings, repeat } = get();

    if (
      isCrossfading ||
      settings.crossfadeSeconds <= 0 ||
      repeat === RepeatMode.One ||
      duration <= settings.crossfadeSeconds * 2 ||
      duration - position > settings.crossfadeSeconds
    ) {
      return;
    }

    advance(false, true);
  }

  return {
    queue: [],
    index: 0,
    unshuffled: null,
    repeat: RepeatMode.Off,
    status: PlaybackStatus.Idle,
    position: 0,
    duration: 0,
    settings: initial,
    playTracks: (tracks, startIndex) => {
      set({ queue: tracks, unshuffled: null });
      start(startIndex);
    },
    togglePlay: () => {
      const { status, settings, queue, index } = get();

      if (status === PlaybackStatus.Playing) {
        engine.pause(settings.fadeMs);
        set({ status: PlaybackStatus.Paused });
      } else if (status === PlaybackStatus.Idle && queue[index]) {
        start(index, get().position);
      } else {
        engine.play(settings.fadeMs).catch(() => set({ status: PlaybackStatus.Paused }));
      }
    },
    next: () => advance(true, false),
    previous: () => {
      const { queue, index, repeat } = get();

      if (engine.position > RESTART_THRESHOLD_SECONDS) {
        engine.seek(0);

        return;
      }

      start(previousIndex({ queue, index }, repeat));
    },
    seek: (seconds) => {
      engine.seek(seconds);
      isCrossfading = false;
      set({ position: seconds });
    },
    jumpTo: (index) => start(index),
    toggleShuffle: () => {
      const { queue, index, unshuffled } = get();

      if (unshuffled) {
        const current = queue[index];
        const restored = unshuffled.findIndex((track) => track.id === current?.id);
        set({ queue: unshuffled, index: Math.max(0, restored), unshuffled: null });
      } else {
        set({ ...shuffleQueue({ queue, index }), unshuffled: queue });
      }
    },
    cycleRepeat: () => {
      const position = REPEAT_ORDER.indexOf(get().repeat);
      set({ repeat: REPEAT_ORDER[(position + 1) % REPEAT_ORDER.length] ?? RepeatMode.Off });
    },
    addToQueue: (tracks) => set({ queue: [...get().queue, ...tracks] }),
    playNext: (tracks) => set(insertNext(get(), tracks)),
    removeFromQueue: (position) => {
      const { index } = get();

      if (position === index) {
        return;
      }

      set(removeAt(get(), position));
    },
    moveInQueue: (from, to) => set(moveItem(get(), from, to)),
    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      set({ settings });
      saveSettings(settings);
      engine.setVolume(settings.volume);
      engine.setEqualizer(settings.isEqEnabled, settings.eqGains);
    },
  };
});

export function currentTrack(state: Pick<PlayerState, 'queue' | 'index'>) {
  return state.queue[state.index] ?? null;
}
