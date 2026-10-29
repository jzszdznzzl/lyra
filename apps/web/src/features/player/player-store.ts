import { create } from 'zustand';

import {
  MAX_SHARED_QUEUE,
  MediaKind,
  MusicError,
  UpNext,
  VideoMatch,
  currentPositionMs,
} from '@lyra/shared';
import type { Command, PlaybackState, Track } from '@lyra/shared';

import { AudioEngine } from '../../audio/engine.ts';
import { fetchLoudness } from '../../audio/loudness.ts';
import { MixCache } from '../../audio/mix/mix-cache.ts';
import { planMix } from '../../audio/mix/mix-plan.ts';
import type { MixPlan } from '../../audio/mix/mix-plan.ts';
import type { PreparedTrack } from '../../audio/mix/prepare.ts';
import {
  RepeatMode,
  freshRadio,
  insertNext,
  moveItem,
  nextIndex,
  previousIndex,
  radioSeed,
  removeAt,
  shuffleQueue,
} from '../../audio/queue.ts';
import { audioStreamUrl, streamFailure } from '../../audio/stream-url.ts';
import { NoContent, api } from '../../lib/api.ts';
import { ListenTracker } from './listen-tracker.ts';
import {
  effectiveQuality,
  loadSettings,
  maxVolume,
  outputSettings,
  saveSettings,
} from './settings.ts';
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
  // Sleep timer set to the end of the current song: the next one is loaded but not played.
  stopsAfterTrack: boolean;
  // Set when YouTube needs this user's Google account; skipping would only fail song after song.
  googleBlock: MusicError | null;
  dismissGoogleBlock: () => void;
  playTracks: (tracks: Track[], startIndex: number) => void;
  /** Plays a song picked outside a playlist or album, followed by similar songs. */
  playRadio: (track: Track) => void;
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
  setStopsAfterTrack: (isOn: boolean) => void;
  /** Fades the music out slowly and pauses: the sleep timer ran out. */
  sleep: () => void;
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
// Seconds before the crossfade when the next song starts buffering.
const PRELOAD_LEAD_SECONDS = 15;
// Seconds before the end when the mix downloads and analyses the current and next songs.
const MIX_PREPARE_LEAD_SECONDS = 90;
// The mix is handed to the engine this early; the engine waits for the bar line itself.
const MIX_TRIGGER_LEAD_SECONDS = 0.6;
// Too short to mix: the transition would eat most of the song.
const MIN_MIX_DURATION_SECONDS = 60;
// Long enough to drift off to, short enough to not seem stuck.
const SLEEP_FADE_MS = 10_000;
// The radio continues from one of the last few songs, so it does not loop around one artist.
const RADIO_SEED_SPREAD = 5;
// Songs remembered as recently heard, so a new radio does not bring them straight back.
const RECENT_LIMIT = 200;
// Below this, skipping recently heard songs leaves the radio too thin, so they are allowed back.
const MIN_FRESH_RADIO = 10;
const GOOGLE_ERRORS: readonly MusicError[] = [
  MusicError.GoogleNotLinked,
  MusicError.GoogleSessionExpired,
];

/** Songs of one album played in order often run into each other, so they are left alone. */
function isSameAlbum(current: Track, next: Track) {
  const albumId = current.album?.id ?? null;

  return albumId !== null && albumId === (next.album?.id ?? null);
}

export function streamUrl(track: Track, settings: PlayerSettings) {
  return audioStreamUrl(track.id, effectiveQuality(settings).quality);
}

export const usePlayerStore = create<PlayerState>()((set, get) => {
  let isCrossfading = false;
  // Queue index of the song being mixed out, so one song is mixed out only once.
  let mixedOutOf: number | null = null;
  const mixCache = new MixCache();
  let isFetchingRadio = false;
  // Bumped whenever a new queue replaces the old one, so a late radio does not land in it.
  let queueGeneration = 0;
  const recentIds: string[] = [];
  let failuresInARow = 0;
  // The song already retried from where it broke, so a second failure skips it.
  let retriedTrackId: string | null = null;
  const listens = new ListenTracker();

  const engine = new AudioEngine(
    {
      onTime: (position, duration) => {
        if (get().remote) {
          return;
        }

        if (position >= HEALTHY_PLAYBACK_SECONDS) {
          failuresInARow = 0;
          retriedTrackId = null;
        }

        set({ position, duration });
        maybeCrossfade(position, duration || (get().queue[get().index]?.durationSeconds ?? 0));

        const current = get().queue[get().index];

        // Counted for the server's statistics, and added to YouTube history when the user has that
        // on; failures do not matter.
        if (current && listens.update(current.id, position, duration)) {
          void api('POST', `/music/history/${encodeURIComponent(current.id)}`, NoContent, {
            track: current,
          });
        }
      },
      onEnded: () => advance(false, false),
      onError: () => {
        void recover();
      },
      onPlayingChange: (isPlaying) => {
        if (!get().remote) {
          set({ status: isPlaying ? PlaybackStatus.Playing : PlaybackStatus.Paused });
        }
      },
    },
    fetchLoudness,
  );

  const initial = loadSettings();
  engine.setVolume(initial.volume);
  engine.setEqualizer(initial.isEqEnabled, initial.eqGains);
  engine.setOutput(outputSettings(initial));

  function remember(track: Track) {
    if (recentIds.at(-1) !== track.id) {
      recentIds.push(track.id);
    }

    if (recentIds.length > RECENT_LIMIT) {
      recentIds.shift();
    }
  }

  function replaceQueue(queue: Track[]) {
    queueGeneration += 1;
    isFetchingRadio = false;
    set({ queue, unshuffled: null, isShuffled: false });
  }

  function start(index: number, startAt = 0, shouldPlay = true) {
    const { queue, settings } = get();
    const track = queue[index];

    if (!track) {
      return;
    }

    remember(track);
    isCrossfading = false;
    mixedOutOf = null;
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

  /**
   * Like YT Music: when the queue runs out, keep going with a radio of similar songs. A radio
   * started by picking a song always loads, whatever the autoplay setting.
   */
  async function topUpRadio(isRadioStart = false) {
    const { queue, index, settings, repeat } = get();
    const seed = isRadioStart ? queue[0] : radioSeed(queue, RADIO_SEED_SPREAD);

    if (isFetchingRadio || !seed) {
      return;
    }

    if (
      !isRadioStart &&
      (!settings.isAutoplayEnabled || repeat !== RepeatMode.Off || queue.length - index > 2)
    ) {
      return;
    }

    const generation = queueGeneration;
    isFetchingRadio = true;
    const result = await api('GET', `/music/up-next/${encodeURIComponent(seed.id)}`, UpNext);

    if (generation !== queueGeneration) {
      return;
    }

    isFetchingRadio = false;

    if (result.data) {
      const queued = get().queue.map((track) => track.id);
      const fresh = freshRadio(result.data.tracks, new Set([...recentIds, ...queued]));
      const tracks =
        fresh.length >= MIN_FRESH_RADIO ? fresh : freshRadio(result.data.tracks, new Set(queued));
      set({ queue: [...get().queue, ...tracks] });
    }
  }

  /**
   * A dropped connection resumes the song once; a song YouTube refuses is skipped; a missing
   * Google account stops playback and tells the user.
   */
  async function recover() {
    const { queue, index, settings } = get();
    const track = queue[index];
    const position = engine.position;
    const reason = track ? await streamFailure(streamUrl(track, settings)) : null;

    // The user moved on while the server was asked.
    if (get().index !== index || get().queue !== queue) {
      return;
    }

    if (reason && GOOGLE_ERRORS.includes(reason)) {
      failuresInARow = 0;
      engine.pause(0);
      set({ status: PlaybackStatus.Paused, googleBlock: reason });

      return;
    }

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

    if (!isUserAction && get().stopsAfterTrack) {
      set({ stopsAfterTrack: false });

      if (target === null) {
        engine.pause(0);
        set({ status: PlaybackStatus.Paused });
      } else {
        // Ready but paused, so play continues with the next song.
        start(target, 0, false);
      }

      return;
    }

    if (target === null) {
      engine.pause(0);
      set({ status: PlaybackStatus.Paused });

      return;
    }

    const track = queue[target];

    if (withCrossfade && track && target !== index) {
      isCrossfading = true;
      remember(track);
      set({ index: target, position: 0, duration: track.durationSeconds ?? 0 });
      engine
        .crossfade(streamUrl(track, settings), settings.crossfadeSeconds)
        .catch((error: unknown) => {
          // Aborted because the user moved on; anything else means the next song cannot play.
          const isAborted = error instanceof DOMException && error.name === 'AbortError';

          if (!isAborted && get().index === target && get().queue[target]?.id === track.id) {
            void recover();
          }
        });
      void topUpRadio();

      return;
    }

    start(target);
  }

  function startMix(target: number, track: Track, plan: MixPlan, prepared: PreparedTrack) {
    mixedOutOf = get().index;
    remember(track);
    set({ index: target, position: plan.incomingStartAt, duration: track.durationSeconds ?? 0 });
    engine.mix(prepared.url, plan, prepared.loudnessDb).catch((error: unknown) => {
      const isAborted = error instanceof DOMException && error.name === 'AbortError';

      if (!isAborted && get().index === target && get().queue[target]?.id === track.id) {
        void recover();
      }
    });
    void topUpRadio();
  }

  /**
   * DJ-style mix: near the end, both songs are downloaded and analysed, and the next one comes in
   * on a bar line at the same tempo. A song not ready in time simply ends.
   */
  function maybeMix(position: number, duration: number, current: Track, target: number) {
    const { queue, settings } = get();
    const next = queue[target];

    if (!next || mixedOutOf === get().index || duration - position > MIX_PREPARE_LEAD_SECONDS) {
      return;
    }

    mixCache.keepOnly([current.id, next.id]);
    mixCache.request(current.id, streamUrl(current, settings));
    mixCache.request(next.id, streamUrl(next, settings));
    const outgoing = mixCache.get(current.id);
    const incoming = mixCache.get(next.id);

    if (!incoming) {
      return;
    }

    engine.preload(incoming.url, incoming.loudnessDb);

    if (!outgoing) {
      return;
    }

    const plan = planMix(outgoing.analysis, incoming.analysis);

    if (position >= plan.startAt - MIX_TRIGGER_LEAD_SECONDS) {
      startMix(target, next, plan, incoming);
    }
  }

  function maybeCrossfade(position: number, duration: number) {
    const { settings, repeat, queue, index, stopsAfterTrack } = get();

    // The song must end on its own, without the next one fading in.
    if (stopsAfterTrack) {
      return;
    }

    const current = queue[index];
    const mixTarget = nextIndex({ queue, index }, repeat, false);
    const mixNext = mixTarget === null || mixTarget === index ? null : queue[mixTarget];

    if (
      settings.isMixEnabled &&
      repeat !== RepeatMode.One &&
      current &&
      mixTarget !== null &&
      mixNext &&
      !isSameAlbum(current, mixNext) &&
      duration >= MIN_MIX_DURATION_SECONDS
    ) {
      maybeMix(position, duration, current, mixTarget);

      return;
    }

    const seconds = settings.crossfadeSeconds;
    const remaining = duration - position;

    if (seconds <= 0 || repeat === RepeatMode.One || duration <= seconds * 2) {
      return;
    }

    // Far from the end again (the new song after a crossfade, or a seek back): arm the next one.
    if (remaining > seconds) {
      isCrossfading = false;
    }

    const target = nextIndex({ queue, index }, repeat, false);
    const next = target === null || target === index ? null : queue[target];

    // With nothing queued yet (the radio may still be loading), the song ends on its own.
    if (isCrossfading || !next) {
      return;
    }

    if (remaining <= seconds) {
      advance(false, true);
    } else if (remaining <= seconds + PRELOAD_LEAD_SECONDS) {
      engine.preload(streamUrl(next, settings));
    }
  }

  // --- Local implementations; every public action runs one of these or sends a command ---

  const local = {
    playTracks: (tracks: Track[], startIndex: number) => {
      replaceQueue(tracks);
      start(startIndex);
    },
    playRadio: (track: Track) => {
      replaceQueue([track]);
      start(0);
      void topUpRadio(true);
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
    setVolume: (requested: number) => {
      // A remote device asking for a boost gets 100% unless this device allows more.
      const volume = Math.min(requested, maxVolume(get().settings));
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
      case 'playRadio': {
        local.playRadio(command.track);
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
    stopsAfterTrack: false,
    googleBlock: null,
    dismissGoogleBlock: () => set({ googleBlock: null }),
    playTracks: (tracks, index) =>
      act({ type: 'playTracks', tracks: tracks.slice(0, MAX_SHARED_QUEUE), index }),
    playRadio: (track) => act({ type: 'playRadio', track }),
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
      const merged = { ...get().settings, ...patch };
      // Turning the boost off brings a boosted volume back to 100%.
      const settings = { ...merged, volume: Math.min(merged.volume, maxVolume(merged)) };
      set({ settings });
      saveSettings(settings);
      engine.setVolume(settings.volume);
      engine.setEqualizer(settings.isEqEnabled, settings.eqGains);
      engine.setOutput(outputSettings(settings));
    },
    setStopsAfterTrack: (stopsAfterTrack) => set({ stopsAfterTrack }),
    sleep: () => {
      if (get().remote || get().status !== PlaybackStatus.Playing) {
        act({ type: 'pause' });

        return;
      }

      engine.pause(SLEEP_FADE_MS);
      set({ status: PlaybackStatus.Paused });
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
      queueGeneration += 1;
      isFetchingRadio = false;
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
