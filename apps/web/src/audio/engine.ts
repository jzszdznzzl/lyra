import { MAX_VOLUME } from '@lyra/shared';

import { EQ_FREQUENCIES, clampGain } from './equalizer.ts';
import {
  LIMITER_ATTACK_SECONDS,
  LIMITER_RATIO,
  LIMITER_RELEASE_SECONDS,
  LIMITER_THRESHOLD_DB,
  limiterMakeupCompensation,
  normalizationGain,
} from './loudness.ts';
import { beatError } from './mix/mix-plan.ts';
import type { MixPlan } from './mix/mix-plan.ts';

interface Deck {
  audio: HTMLAudioElement;
  // Fades: play, pause and crossfade.
  gain: GainNode;
  // Evens out loudness between songs.
  level: GainNode;
  // Cuts the bass of one song while the other carries it, as DJs do in a mix.
  bass: BiquadFilterNode;
  loudnessDb: number | null;
}

export interface EngineEvents {
  onTime: (position: number, duration: number) => void;
  onEnded: () => void;
  onError: () => void;
  onPlayingChange: (isPlaying: boolean) => void;
}

export interface OutputSettings {
  isLimiterEnabled: boolean;
  isNormalizationEnabled: boolean;
}

/** YouTube's loudness measure for a stream URL, or null when unknown. */
export type LoudnessSource = (url: string) => Promise<number | null>;

// Exponential ramps cannot reach zero; this is silent enough.
const SILENCE = 0.0001;
const EQ_Q = 1.1;
// Points in a crossfade curve; enough for a smooth fade without a large buffer.
const CURVE_STEPS = 64;
// Smooths level changes, so a song evened out just after it starts does not jump.
const LEVEL_TIME_CONSTANT = 0.05;
const BASS_FREQUENCY = 180;
const BASS_CUT_DB = 24;
// How often, and how hard, a mix nudges the incoming tempo to keep the beats together.
const PHASE_LOCK_MS = 200;
const PHASE_GAIN = 1;
const MAX_NUDGE = 0.03;
// After a mix, the incoming song eases back to its own tempo over this long.
const RATE_RESTORE_SECONDS = 8;
const RATE_RESTORE_STEP_MS = 250;
const METADATA_TIMEOUT_MS = 3000;

/** Resolves once the element knows the song's duration, so seeking it is kept. */
function whenMetadata(audio: HTMLAudioElement) {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
    setTimeout(resolve, METADATA_TIMEOUT_MS);
  });
}

/**
 * Two <audio> decks routed through Web Audio. One deck plays; the other takes the next song for
 * crossfades. Every fade is a gain ramp, so the elements themselves always play at full volume.
 */
export class AudioEngine {
  #context: AudioContext | null = null;
  #decks: [Deck, Deck] | null = null;
  #active = 0;
  #filters: BiquadFilterNode[] = [];
  #master: GainNode | null = null;
  #limiter: DynamicsCompressorNode | null = null;
  #events: EngineEvents;
  #loudnessOf: LoudnessSource;
  #output: OutputSettings = { isLimiterEnabled: true, isNormalizationEnabled: true };
  #eqGains: number[] = EQ_FREQUENCIES.map(() => 0);
  #isEqEnabled = false;
  #volume = 1;
  #fadeTimer: ReturnType<typeof setTimeout> | null = null;
  // The deck fading out during a crossfade, until it is stopped.
  #outgoing: Deck | null = null;
  #outgoingTimer: ReturnType<typeof setTimeout> | null = null;
  #preloadedUrl: string | null = null;
  // Keeps the beats together during a mix, then eases the tempo back.
  #mixTimer: ReturnType<typeof setInterval> | null = null;

  constructor(events: EngineEvents, loudnessOf: LoudnessSource) {
    this.#events = events;
    this.#loudnessOf = loudnessOf;
  }

  #ensureGraph() {
    if (this.#context && this.#decks && this.#master) {
      return { context: this.#context, decks: this.#decks, master: this.#master };
    }

    const context = new AudioContext({ latencyHint: 'playback' });
    const master = context.createGain();
    master.gain.value = this.#volume ** 2;

    this.#filters = EQ_FREQUENCIES.map((frequency, band) => {
      const filter = context.createBiquadFilter();
      filter.type =
        band === 0 ? 'lowshelf' : band === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = frequency;
      filter.Q.value = EQ_Q;

      return filter;
    });

    // Filters chain in series into the master volume.
    const chain = [...this.#filters, master];
    chain.reduce<AudioNode | null>((previous, node) => {
      previous?.connect(node);

      return node;
    }, null);

    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = LIMITER_THRESHOLD_DB;
    limiter.knee.value = 0;
    limiter.ratio.value = LIMITER_RATIO;
    limiter.attack.value = LIMITER_ATTACK_SECONDS;
    limiter.release.value = LIMITER_RELEASE_SECONDS;
    const limiterTrim = context.createGain();
    limiterTrim.gain.value = limiterMakeupCompensation(LIMITER_THRESHOLD_DB, LIMITER_RATIO);
    limiter.connect(limiterTrim);
    limiterTrim.connect(context.destination);

    const decks = [this.#createDeck(context), this.#createDeck(context)] as const;

    this.#context = context;
    this.#master = master;
    this.#limiter = limiter;
    this.#decks = [decks[0], decks[1]];
    this.#applyEq();
    this.#applyOutput();

    return { context, decks: this.#decks, master };
  }

  #createDeck(context: AudioContext): Deck {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'use-credentials';

    const gain = context.createGain();
    gain.gain.value = SILENCE;
    const level = context.createGain();
    const bass = context.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = BASS_FREQUENCY;
    bass.gain.value = 0;
    context.createMediaElementSource(audio).connect(gain);
    gain.connect(level);
    level.connect(bass);
    bass.connect(this.#filters[0] ?? context.destination);

    const isActive = () => this.#decks?.[this.#active] === deck;
    const deck: Deck = { audio, gain, level, bass, loudnessDb: null };

    audio.addEventListener('timeupdate', () => {
      if (isActive()) {
        this.#events.onTime(
          audio.currentTime,
          Number.isFinite(audio.duration) ? audio.duration : 0,
        );
      }
    });
    audio.addEventListener('ended', () => {
      if (isActive()) {
        this.#events.onEnded();
      }
    });
    audio.addEventListener('error', () => {
      if (isActive() && audio.src) {
        this.#events.onError();
      }
    });
    audio.addEventListener('play', () => isActive() && this.#events.onPlayingChange(true));
    audio.addEventListener('pause', () => isActive() && this.#events.onPlayingChange(false));

    return deck;
  }

  #applyEq() {
    this.#filters.forEach((filter, band) => {
      filter.gain.value = this.#isEqEnabled ? clampGain(this.#eqGains[band] ?? 0) : 0;
    });
  }

  /** The limiter sits between the master volume and the speakers only while it is on. */
  #applyOutput() {
    const master = this.#master;
    const limiter = this.#limiter;
    const context = this.#context;

    if (!master || !limiter || !context) {
      return;
    }

    master.disconnect();
    master.connect(this.#output.isLimiterEnabled ? limiter : context.destination);

    for (const deck of this.#decks ?? []) {
      this.#applyLevel(deck);
    }
  }

  #applyLevel(deck: Deck) {
    const context = this.#context;
    const { isLimiterEnabled, isNormalizationEnabled } = this.#output;
    const level = isNormalizationEnabled ? normalizationGain(deck.loudnessDb, isLimiterEnabled) : 1;

    if (context) {
      deck.level.gain.setTargetAtTime(level, context.currentTime, LEVEL_TIME_CONSTANT);
    }
  }

  /**
   * Points a deck at a song and evens out its loudness once YouTube's measure arrives. A song
   * downloaded beforehand comes with its measure, so nothing is asked.
   */
  #setSource(deck: Deck, url: string, knownLoudness?: number | null) {
    deck.audio.src = url;
    deck.loudnessDb = knownLoudness ?? null;
    this.#applyLevel(deck);
    const src = deck.audio.src;

    if (knownLoudness !== undefined) {
      return;
    }

    this.#loudnessOf(url)
      .then((loudnessDb) => {
        // The deck may have moved on to another song while this was loading.
        if (deck.audio.src === src) {
          deck.loudnessDb = loudnessDb;
          this.#applyLevel(deck);
        }
      })
      .catch(() => undefined);
  }

  #ramp(gain: GainNode, to: number, ms: number) {
    const context = this.#context;

    if (!context) {
      return;
    }

    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, SILENCE), now);

    if (ms <= 0) {
      gain.gain.setValueAtTime(Math.max(to, SILENCE), now);
    } else {
      gain.gain.exponentialRampToValueAtTime(Math.max(to, SILENCE), now + ms / 1000);
    }
  }

  /**
   * Equal-power fade: the two songs together keep a steady loudness. Exponential ramps fade out
   * too fast and in too late, which leaves a quiet gap in the middle of the crossfade.
   */
  #crossfadeCurve(gain: GainNode, isFadingIn: boolean, seconds: number) {
    const context = this.#context;

    if (!context) {
      return;
    }

    const from = isFadingIn ? SILENCE : Math.max(gain.gain.value, SILENCE);
    const curve = new Float32Array(CURVE_STEPS);

    for (let step = 0; step < CURVE_STEPS; step += 1) {
      const progress = step / (CURVE_STEPS - 1);
      const level = isFadingIn
        ? Math.sin((progress * Math.PI) / 2)
        : from * Math.cos((progress * Math.PI) / 2);
      curve[step] = Math.max(level, SILENCE);
    }

    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(from, now);
    gain.gain.setValueCurveAtTime(curve, now, seconds);
  }

  /** Stops the song that was fading out, if a crossfade is still running. */
  #stopOutgoing() {
    if (this.#outgoingTimer) {
      clearTimeout(this.#outgoingTimer);
      this.#outgoingTimer = null;
    }

    const deck = this.#outgoing;
    this.#outgoing = null;

    if (deck) {
      deck.gain.gain.cancelScheduledValues(0);
      deck.gain.gain.value = SILENCE;
      deck.bass.gain.cancelScheduledValues(0);
      deck.bass.gain.value = 0;
      deck.audio.playbackRate = 1;
      deck.audio.pause();
      deck.audio.removeAttribute('src');
    }
  }

  #clearMixTimer() {
    if (this.#mixTimer) {
      clearInterval(this.#mixTimer);
      this.#mixTimer = null;
    }
  }

  /** Ends a mix early: the playing song keeps its own tempo and its bass. */
  #resetMix() {
    this.#clearMixTimer();
    const deck = this.#decks?.[this.#active];

    if (deck) {
      deck.audio.playbackRate = 1;
      deck.bass.gain.cancelScheduledValues(0);
      deck.bass.gain.value = 0;
    }
  }

  /** Eases a song from the mix tempo back to its own, in steps too small to notice. */
  #restoreRate(deck: Deck, from: number) {
    this.#clearMixTimer();
    const steps = Math.round((RATE_RESTORE_SECONDS * 1000) / RATE_RESTORE_STEP_MS);
    let step = 0;

    if (Math.abs(from - 1) < 0.001) {
      deck.audio.playbackRate = 1;

      return;
    }

    this.#mixTimer = setInterval(() => {
      step += 1;
      deck.audio.playbackRate = from + ((1 - from) * step) / steps;

      if (step >= steps) {
        this.#clearMixTimer();
      }
    }, RATE_RESTORE_STEP_MS);
  }

  /** A fade that follows `curve` from `start` (context time) for `seconds`. */
  #curve(gain: GainNode, from: number, start: number, seconds: number, isFadingIn: boolean) {
    const curve = new Float32Array(CURVE_STEPS);

    for (let step = 0; step < CURVE_STEPS; step += 1) {
      const angle = ((step / (CURVE_STEPS - 1)) * Math.PI) / 2;
      curve[step] = Math.max(isFadingIn ? Math.sin(angle) : from * Math.cos(angle), SILENCE);
    }

    gain.gain.setValueCurveAtTime(curve, start, seconds);
  }

  #clearFadeTimer() {
    if (this.#fadeTimer) {
      clearTimeout(this.#fadeTimer);
      this.#fadeTimer = null;
    }
  }

  get position() {
    return this.#decks?.[this.#active]?.audio.currentTime ?? 0;
  }

  get duration() {
    const duration = this.#decks?.[this.#active]?.audio.duration ?? 0;

    return Number.isFinite(duration) ? duration : 0;
  }

  get isPlaying() {
    const audio = this.#decks?.[this.#active]?.audio;

    return audio ? !audio.paused : false;
  }

  /** Replaces the active song immediately (no crossfade) and optionally starts it. */
  async load(url: string, startAt: number, shouldPlay: boolean, fadeMs: number) {
    const { decks } = this.#ensureGraph();
    const idle = decks[1 - this.#active];
    const deck = decks[this.#active];

    if (!deck || !idle) {
      return;
    }

    this.#clearFadeTimer();
    this.#stopOutgoing();
    this.#resetMix();
    this.#preloadedUrl = null;
    idle.audio.pause();
    idle.audio.removeAttribute('src');
    deck.audio.pause();
    deck.gain.gain.value = SILENCE;
    this.#setSource(deck, url);

    // Seeking before the metadata arrives is not reliably kept, so wait for it when resuming.
    if (startAt > 0) {
      const audio = deck.audio;
      audio.addEventListener('loadedmetadata', () => (audio.currentTime = startAt), { once: true });
    }

    if (shouldPlay) {
      await this.play(fadeMs);
    }
  }

  async play(fadeMs: number) {
    const { context, decks } = this.#ensureGraph();
    const deck = decks[this.#active];

    if (!deck?.audio.src) {
      return;
    }

    this.#clearFadeTimer();
    await context.resume();
    await deck.audio.play();
    this.#ramp(deck.gain, 1, fadeMs);
  }

  pause(fadeMs: number) {
    const deck = this.#decks?.[this.#active];

    if (!deck) {
      return;
    }

    this.#clearFadeTimer();
    // Pausing mid-crossfade must silence the old song too, not leave it fading out alone.
    this.#stopOutgoing();
    this.#resetMix();
    this.#ramp(deck.gain, SILENCE, fadeMs);
    this.#fadeTimer = setTimeout(() => deck.audio.pause(), fadeMs);
  }

  seek(seconds: number) {
    const deck = this.#decks?.[this.#active];

    if (deck) {
      // Seeking mid-mix would pull the beats apart; the new song simply takes over.
      if (this.#mixTimer && this.#outgoing) {
        this.#stopOutgoing();
        this.#resetMix();
      }

      deck.audio.currentTime = Math.max(0, seconds);
    }
  }

  /**
   * Starts buffering the next song on the idle deck, so a crossfade starts on time instead of
   * fading the current song out while the next one is still loading.
   */
  preload(url: string, knownLoudness?: number | null) {
    const decks = this.#decks;
    const idle = decks?.[1 - this.#active];

    if (!idle || this.#outgoing || this.#preloadedUrl === url) {
      return;
    }

    idle.gain.gain.value = SILENCE;
    this.#setSource(idle, url, knownLoudness);
    idle.audio.load();
    this.#preloadedUrl = url;
  }

  /** Starts `url` on the idle deck and fades between the two over `seconds`. */
  async crossfade(url: string, seconds: number) {
    const { context, decks } = this.#ensureGraph();

    // A crossfade still running finishes now, so only two songs ever overlap.
    this.#stopOutgoing();
    this.#resetMix();

    const outgoing = decks[this.#active];
    const incoming = decks[1 - this.#active];

    if (!outgoing || !incoming) {
      return;
    }

    this.#clearFadeTimer();

    // A preload that failed is retried, so the error surfaces on the active deck.
    if (this.#preloadedUrl !== url || incoming.audio.error) {
      this.#setSource(incoming, url);
    }

    this.#preloadedUrl = null;
    incoming.audio.currentTime = 0;
    incoming.gain.gain.cancelScheduledValues(0);
    incoming.gain.gain.value = SILENCE;
    this.#active = 1 - this.#active;
    this.#outgoing = outgoing;

    await context.resume();
    await incoming.audio.play();

    // Skipped or paused while the next song was starting.
    if (this.#outgoing !== outgoing || decks[this.#active] !== incoming) {
      return;
    }

    this.#crossfadeCurve(incoming.gain, true, seconds);
    this.#crossfadeCurve(outgoing.gain, false, seconds);
    this.#outgoingTimer = setTimeout(() => this.#stopOutgoing(), seconds * 1000);
  }

  /**
   * A DJ-style transition: the next song starts on a bar line of this one, at its tempo, and the
   * two swap bass halfway. Without matching beats it is a crossfade from the planned point.
   */
  async mix(url: string, plan: MixPlan, knownLoudness: number | null) {
    const { context, decks } = this.#ensureGraph();
    this.#stopOutgoing();
    this.#resetMix();

    const outgoing = decks[this.#active];
    const incoming = decks[1 - this.#active];

    if (!outgoing || !incoming) {
      return;
    }

    this.#clearFadeTimer();

    if (this.#preloadedUrl !== url || incoming.audio.error) {
      this.#setSource(incoming, url, knownLoudness);
    }

    this.#preloadedUrl = null;
    incoming.gain.gain.cancelScheduledValues(0);
    incoming.gain.gain.value = SILENCE;
    incoming.bass.gain.value = plan.beats ? -BASS_CUT_DB : 0;
    incoming.audio.preservesPitch = true;
    incoming.audio.playbackRate = plan.rate;
    this.#active = 1 - this.#active;
    this.#outgoing = outgoing;
    await whenMetadata(incoming.audio);
    incoming.audio.currentTime = plan.incomingStartAt;

    // Called a moment early; the song comes in on the bar line itself.
    const wait = plan.startAt - outgoing.audio.currentTime;

    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    }

    if (this.#outgoing !== outgoing || decks[this.#active] !== incoming) {
      return;
    }

    await context.resume();
    await incoming.audio.play();

    // Skipped or paused while the next song was starting.
    if (this.#outgoing !== outgoing || decks[this.#active] !== incoming) {
      return;
    }

    const { beats, seconds } = plan;

    if (!beats) {
      this.#crossfadeCurve(incoming.gain, true, seconds);
      this.#crossfadeCurve(outgoing.gain, false, seconds);
      this.#outgoingTimer = setTimeout(() => this.#stopOutgoing(), seconds * 1000);

      return;
    }

    // The new song rises over the first half and the old one falls over the second.
    const now = context.currentTime;
    const half = seconds / 2;
    const from = Math.max(outgoing.gain.gain.value, SILENCE);
    incoming.gain.gain.cancelScheduledValues(now);
    this.#curve(incoming.gain, SILENCE, now, half, true);
    outgoing.gain.gain.cancelScheduledValues(now);
    outgoing.gain.gain.setValueAtTime(from, now);
    this.#curve(outgoing.gain, from, now + half, half, false);

    // Bass swap over one beat in the middle: only one kick drum and bass line at a time.
    const swapStart = now + half - beats.outgoing.period / 2;
    const swapEnd = now + half + beats.outgoing.period / 2;
    outgoing.bass.gain.setValueAtTime(0, swapStart);
    outgoing.bass.gain.linearRampToValueAtTime(-BASS_CUT_DB, swapEnd);
    incoming.bass.gain.setValueAtTime(-BASS_CUT_DB, swapStart);
    incoming.bass.gain.linearRampToValueAtTime(0, swapEnd);

    this.#mixTimer = setInterval(() => {
      const error = beatError(beats, outgoing.audio.currentTime, incoming.audio.currentTime);
      const nudge = Math.min(MAX_NUDGE, Math.max(-MAX_NUDGE, -error * PHASE_GAIN));
      incoming.audio.playbackRate = plan.rate * (1 + nudge);
    }, PHASE_LOCK_MS);

    this.#outgoingTimer = setTimeout(() => {
      this.#stopOutgoing();
      this.#restoreRate(incoming, plan.rate);
    }, seconds * 1000);
  }

  setVolume(volume: number) {
    this.#volume = Math.min(MAX_VOLUME, Math.max(0, volume));

    // Squared, because loudness is perceived logarithmically and a linear slider feels jumpy.
    if (this.#master && this.#context) {
      this.#master.gain.setTargetAtTime(this.#volume ** 2, this.#context.currentTime, 0.02);
    }
  }

  setEqualizer(isEnabled: boolean, gains: number[]) {
    this.#isEqEnabled = isEnabled;
    this.#eqGains = gains;
    this.#applyEq();
  }

  setOutput(output: OutputSettings) {
    this.#output = output;
    this.#applyOutput();
  }

  stop() {
    this.#clearFadeTimer();
    this.#stopOutgoing();
    this.#resetMix();
    this.#preloadedUrl = null;

    for (const deck of this.#decks ?? []) {
      deck.audio.pause();
      deck.audio.removeAttribute('src');
    }
  }
}
