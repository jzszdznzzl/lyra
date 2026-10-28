import { EQ_FREQUENCIES, clampGain } from './equalizer.ts';

interface Deck {
  audio: HTMLAudioElement;
  gain: GainNode;
}

export interface EngineEvents {
  onTime: (position: number, duration: number) => void;
  onEnded: () => void;
  onError: () => void;
  onPlayingChange: (isPlaying: boolean) => void;
}

// Exponential ramps cannot reach zero; this is silent enough.
const SILENCE = 0.0001;
const EQ_Q = 1.1;

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
  #events: EngineEvents;
  #eqGains: number[] = EQ_FREQUENCIES.map(() => 0);
  #isEqEnabled = false;
  #volume = 1;
  #fadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(events: EngineEvents) {
    this.#events = events;
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
    master.connect(context.destination);

    const decks = [this.#createDeck(context), this.#createDeck(context)] as const;

    this.#context = context;
    this.#master = master;
    this.#decks = [decks[0], decks[1]];
    this.#applyEq();

    return { context, decks: this.#decks, master };
  }

  #createDeck(context: AudioContext): Deck {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'use-credentials';

    const gain = context.createGain();
    gain.gain.value = SILENCE;
    context.createMediaElementSource(audio).connect(gain);
    gain.connect(this.#filters[0] ?? context.destination);

    const isActive = () => this.#decks?.[this.#active] === deck;
    const deck: Deck = { audio, gain };

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
    idle.audio.pause();
    idle.audio.removeAttribute('src');
    deck.audio.pause();
    deck.gain.gain.value = SILENCE;
    deck.audio.src = url;

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
    this.#ramp(deck.gain, SILENCE, fadeMs);
    this.#fadeTimer = setTimeout(() => deck.audio.pause(), fadeMs);
  }

  seek(seconds: number) {
    const deck = this.#decks?.[this.#active];

    if (deck) {
      deck.audio.currentTime = Math.max(0, seconds);
    }
  }

  /** Starts `url` on the idle deck and fades between the two over `seconds`. */
  async crossfade(url: string, seconds: number) {
    const { context, decks } = this.#ensureGraph();
    const outgoing = decks[this.#active];
    const incoming = decks[1 - this.#active];

    if (!outgoing || !incoming) {
      return;
    }

    this.#clearFadeTimer();
    incoming.audio.src = url;
    incoming.audio.currentTime = 0;
    incoming.gain.gain.value = SILENCE;
    this.#active = 1 - this.#active;

    await context.resume();
    await incoming.audio.play();
    this.#ramp(incoming.gain, 1, seconds * 1000);
    this.#ramp(outgoing.gain, SILENCE, seconds * 1000);
    this.#fadeTimer = setTimeout(() => {
      outgoing.audio.pause();
      outgoing.audio.removeAttribute('src');
    }, seconds * 1000);
  }

  setVolume(volume: number) {
    this.#volume = Math.min(1, Math.max(0, volume));

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

  stop() {
    this.#clearFadeTimer();

    for (const deck of this.#decks ?? []) {
      deck.audio.pause();
      deck.audio.removeAttribute('src');
    }
  }
}
