import { create } from 'zustand';

import { MAX_SHARED_QUEUE, MediaKind, UpNext, VideoMatch, currentPositionMs } from '@lyra/shared';
import type { Command, PlaybackState, Track } from '@lyra/shared';

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
import { audioStreamUrl } from '../../audio/stream-url.ts';
import { api } from '../../lib/api.ts';
import { effectiveQuality, loadSettings, saveSettings } from './settings.ts';
import type { PlayerSettings } from './settings.ts';

export const PlaybackStatus = Object.freeze({
  Idle: 'idle',
  Loading: 'loading',
  Playing: 'playing',
  Paused: 'paused',
} as const);

export type PlaybackStatus = (typeof PlaybackStatus)[keyof typeof PlaybackStatus];

/** Set by Connect while another device plays: actions become commands sent to it. */
export interface RemoteControl {
  send: (command: Command) => void;
  volume: number;
}

interface PlayerState {
  queue: Track[];
  index: number;
  // The order before shuffling, so turning shuffle off restores it.
  unshuffled: Track[] | null;
  isShuffled: boolean;
  repeat: RepeatMode;
  status: PlaybackStatus;
  position: number;
  duration: number;
  settings: PlayerSettings;
  remote: RemoteControl | null;
  // Shows the music video instead of the cover; the audio engine keeps playing either way.
  isVideoMode: boolean;
  isFindingVideo: boolean;
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
  setVolume: (volume: number) => void;
  updateSettings: (patch: Partial<PlayerSettings>) => void;
  // --- Used by Connect ---
  runCommand: (command: Command) => void;
  snapshot: () => PlaybackState;
  takeover: (state: PlaybackState, serverNow: number) => void;
  release: () => void;
  mirror: (state: PlaybackState | null, remote: RemoteControl, serverNow: number) => void;
  setLocal: () => void;
  /** Shows the video, swapping a song for its music video; false when none exists. */
  showVideo: () => Promise<boolean>;
  hideVideo: () => void;
}

// Restarting the song is friendlier than going back once a few seconds have played.
const RESTART_THRESHOLD_SECONDS = 3;
const REPEAT_ORDER = [RepeatMode.Off, RepeatMode.All, RepeatMode.One] as const;
// Context kept before the current track when the queue is too long to share whole.
const SHARED_HISTORY = 100;
// Songs failing in a row before playback stops, so a broken connection or format does not race
// through the whole queue.
const MAX_FAILURES_IN_A_ROW = 3;
// Playing this long proves the stream works, so earlier failures stop counting.
const HEALTHY_PLAYBACK_SECONDS = 5;

export function streamUrl(track: Track, settings: PlayerSettings) {
  return audioStreamUrl(track.id, effectiveQuality(settings).quality);
}

export const usePlayerStore = create<PlayerState>()((set, get) => {
  let isCrossfading = false;
  let isFetchingRadio = false;
  let failuresInARow = 0;
  // The song already retried from where it broke, so a second failure skips it.
  let retriedTrackId: string | null = null;

  const engine = new AudioEngine({
    onTime: (position, duration) => {
      if (get().remote) {
        return;
      }

      if (position >= HEALTHY_PLAYBACK_SECONDS) {
        failuresInARow = 0;
        retriedTrackId = null;
      }

      set({ position, duration });
      maybeCrossfade(position, duration);
    },
    onEnded: () => advance(false, false),
    onError: () => recover(),
    onPlayingChange: (isPlaying) => {
      if (!get().remote) {
        set({ status: isPlaying ? PlaybackStatus.Playing : PlaybackStatus.Paused });
      }
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
      status: shouldPlay ? PlaybackStatus.Loading : PlaybackStatus.Paused,
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

  /** A dropped connection resumes the song once; a song YouTube refuses is skipped. */
  function recover() {
    const { queue, index } = get();
    const track = queue[index];
    const position = engine.position;

    if (track && position > 0 && retriedTrackId !== track.id) {
      retriedTrackId = track.id;
      start(index, position);

      return;
    }

    failuresInARow += 1;

    if (failuresInARow >= MAX_FAILURES_IN_A_ROW) {
      failuresInARow = 0;
      engine.pause(0);
      set({ status: PlaybackStatus.Paused });

      return;
    }

    advance(false, false);
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

  // --- Local implementations; every public action runs one of these or sends a command ---

  const local = {
    playTracks: (tracks: Track[], startIndex: number) => {
      set({ queue: tracks, unshuffled: null, isShuffled: false });
      start(startIndex);
    },
    play: () => {
      const { status, queue, index, settings, position } = get();

      if (status === PlaybackStatus.Idle && queue[index]) {
        start(index, position);
      } else {
        // Resuming inside a pause fade never stops the element, so no "play" event would come.
        engine
          .play(settings.fadeMs)
          .then(() => set({ status: PlaybackStatus.Playing }))
          .catch(() => set({ status: PlaybackStatus.Paused }));
      }
    },
    pause: () => {
      engine.pause(get().settings.fadeMs);
      set({ status: PlaybackStatus.Paused });
    },
    previous: () => {
      const { queue, index, repeat } = get();

      if (engine.position > RESTART_THRESHOLD_SECONDS) {
        engine.seek(0);

        return;
      }

      start(previousIndex({ queue, index }, repeat));
    },
    seek: (seconds: number) => {
      engine.seek(seconds);
      isCrossfading = false;
      set({ position: seconds });
    },
    toggleShuffle: () => {
      const { queue, index, unshuffled } = get();

      if (unshuffled) {
        const current = queue[index];
        const restored = unshuffled.findIndex((track) => track.id === current?.id);
        set({
          queue: unshuffled,
          index: Math.max(0, restored),
          unshuffled: null,
          isShuffled: false,
        });
      } else {
        set({ ...shuffleQueue({ queue, index }), unshuffled: queue, isShuffled: true });
      }
    },
    cycleRepeat: () => {
      const position = REPEAT_ORDER.indexOf(get().repeat);
      set({ repeat: REPEAT_ORDER[(position + 1) % REPEAT_ORDER.length] ?? RepeatMode.Off });
    },
    enqueue: (tracks: Track[], isNext: boolean) => {
      set(isNext ? insertNext(get(), tracks) : { queue: [...get().queue, ...tracks] });
    },
    remove: (position: number) => {
      if (position !== get().index) {
        set(removeAt(get(), position));
      }
    },
    setVolume: (volume: number) => {
      const settings = { ...get().settings, volume };
      set({ settings });
      saveSettings(settings);
      engine.setVolume(volume);
    },
  };

  function runCommand(command: Command) {
    // Whoever asks for something new gets a fresh set of attempts.
    failuresInARow = 0;

    switch (command.type) {
      case 'play': {
        local.play();
        break;
      }
      case 'pause': {
        local.pause();
        break;
      }
      case 'next': {
        advance(true, false);
        break;
      }
      case 'previous': {
        local.previous();
        break;
      }
      case 'seek': {
        local.seek(command.positionMs / 1000);
        break;
      }
      case 'volume': {
        local.setVolume(command.volume);
        break;
      }
      case 'jump': {
        start(command.index);
        break;
      }
      case 'playTracks': {
        local.playTracks(command.tracks, command.index);
        break;
      }
      case 'enqueue': {
        local.enqueue(command.tracks, command.isNext);
        break;
      }
      case 'remove': {
        local.remove(command.index);
        break;
      }
      case 'move': {
        set(moveItem(get(), command.from, command.to));
        break;
      }
      case 'replace': {
        const { queue, index } = get();

        if (command.index >= 0 && command.index < queue.length) {
          set({
            queue: queue.map((track, position) =>
              position === command.index ? command.track : track,
            ),
          });

          if (command.index === index) {
            start(index, engine.position, get().status !== PlaybackStatus.Paused);
          }
        }

        break;
      }
      case 'shuffle': {
        local.toggleShuffle();
        break;
      }
      case 'repeat': {
        local.cycleRepeat();
        break;
      }
      default: {
        break;
      }
    }
  }

  /** Sends to the playing device when there is one elsewhere; runs here otherwise. */
  function act(command: Command) {
    const { remote } = get();

    if (remote) {
      remote.send(command);

      // Reflect it here right away; waiting for the playing device's report feels laggy.
      if (command.type === 'play' || command.type === 'pause') {
        set({ status: command.type === 'play' ? PlaybackStatus.Playing : PlaybackStatus.Paused });
      } else if (command.type === 'seek') {
        set({ position: command.positionMs / 1000 });
      }
    } else {
      runCommand(command);
    }
  }

  return {
    queue: [],
    index: 0,
    unshuffled: null,
    isShuffled: false,
    repeat: RepeatMode.Off,
    status: PlaybackStatus.Idle,
    position: 0,
    duration: 0,
    settings: initial,
    remote: null,
    isVideoMode: false,
    isFindingVideo: false,
    playTracks: (tracks, index) =>
      act({ type: 'playTracks', tracks: tracks.slice(0, MAX_SHARED_QUEUE), index }),
    togglePlay: () => act({ type: get().status === PlaybackStatus.Playing ? 'pause' : 'play' }),
    next: () => act({ type: 'next' }),
    previous: () => act({ type: 'previous' }),
    seek: (seconds) => act({ type: 'seek', positionMs: Math.max(0, seconds * 1000) }),
    jumpTo: (index) => act({ type: 'jump', index }),
    toggleShuffle: () => act({ type: 'shuffle' }),
    cycleRepeat: () => act({ type: 'repeat' }),
    addToQueue: (tracks) => act({ type: 'enqueue', tracks, isNext: false }),
    playNext: (tracks) => act({ type: 'enqueue', tracks, isNext: true }),
    removeFromQueue: (index) => act({ type: 'remove', index }),
    moveInQueue: (from, to) => act({ type: 'move', from, to }),
    setVolume: (volume) => {
      const { remote } = get();

      if (remote) {
        // Shown right away; the next sync confirms it.
        set({ remote: { ...remote, volume } });
      }

      act({ type: 'volume', volume });
    },
    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      set({ settings });
      saveSettings(settings);
      engine.setVolume(settings.volume);
      engine.setEqualizer(settings.isEqEnabled, settings.eqGains);
    },
    runCommand,
    snapshot: () => {
      const { queue, index, status, settings, repeat, isShuffled } = get();
      // Long queues are cut to a window around the current track.
      const offset = Math.max(0, Math.min(index - SHARED_HISTORY, queue.length - MAX_SHARED_QUEUE));

      return {
        queue: queue.slice(offset, offset + MAX_SHARED_QUEUE),
        index: index - offset,
        positionMs: Math.round(engine.position * 1000),
        updatedAt: Date.now(),
        isPlaying: status === PlaybackStatus.Playing || status === PlaybackStatus.Loading,
        volume: settings.volume,
        repeat,
        isShuffled,
      };
    },
    takeover: (state, serverNow) => {
      set({
        remote: null,
        queue: state.queue,
        unshuffled: null,
        isShuffled: state.isShuffled,
        repeat: state.repeat,
      });
      start(state.index, currentPositionMs(state, serverNow) / 1000, state.isPlaying);
    },
    release: () => {
      engine.stop();
      isCrossfading = false;
    },
    mirror: (state, remote, serverNow) => {
      engine.stop();

      if (!state) {
        set({ remote, status: PlaybackStatus.Idle });

        return;
      }

      const track = state.queue[state.index];
      set({
        remote: { ...remote, volume: state.volume },
        queue: state.queue,
        index: state.index,
        isShuffled: state.isShuffled,
        repeat: state.repeat,
        status: state.isPlaying ? PlaybackStatus.Playing : PlaybackStatus.Paused,
        position: currentPositionMs(state, serverNow) / 1000,
        duration: track?.durationSeconds ?? 0,
      });
    },
    setLocal: () => {
      if (get().remote) {
        set({ remote: null, status: PlaybackStatus.Idle });
      }
    },
    hideVideo: () => set({ isVideoMode: false }),
    showVideo: async () => {
      const { queue, index } = get();
      const track = queue[index];

      if (!track) {
        return false;
      }

      if (track.kind === MediaKind.Video) {
        set({ isVideoMode: true });

        return true;
      }

      set({ isFindingVideo: true });
      const params = new URLSearchParams({
        title: track.title,
        artist: track.artists.map((artist) => artist.name).join(', '),
      });
      const result = await api('GET', `/music/video-for?${params.toString()}`, VideoMatch);
      set({ isFindingVideo: false });

      const video = result.data?.track;

      // The queue may have moved on while searching; only swap the song that asked.
      if (!video || get().queue[get().index]?.id !== track.id) {
        return false;
      }

      set({ isVideoMode: true });
      act({
        type: 'replace',
        index: get().index,
        track: { ...video, album: video.album ?? track.album },
      });

      return true;
    },
  };
});

export function currentTrack(state: Pick<PlayerState, 'queue' | 'index'>) {
  return state.queue[state.index] ?? null;
}
