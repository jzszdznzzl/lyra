import type { TrackAnalysis } from './beat-analysis.ts';

/** Where the beats of a song fall, in the song's own time. */
export interface BeatGrid {
  offset: number;
  period: number;
}

/** How one song hands over to the next, worked out before the transition starts. */
export interface MixPlan {
  // Position in the outgoing song where the transition starts.
  startAt: number;
  // Length of the transition, in real time.
  seconds: number;
  // Position in the incoming song where it starts playing.
  incomingStartAt: number;
  // Playback rate of the incoming song during the transition, so both share one tempo.
  rate: number;
  // Present when the tempos match: the engine keeps the beats of both songs together.
  beats: { outgoing: BeatGrid; incoming: BeatGrid } | null;
}

// Below this, the detected tempo is a guess; mixing on it would sound like a train wreck.
const MIN_CONFIDENCE = 2;
// Tempo change a listener does not notice, with the pitch kept.
const MAX_RATE_CHANGE = 0.08;
const MIX_BEATS = 16;
const SHORT_MIX_BEATS = 8;
const MAX_MIX_SECONDS = 16;
const FALLBACK_SECONDS = 6;
const BEATS_PER_BAR = 4;
// A transition never starts in the first half of a song, whatever the analysis says.
const MIN_START_FRACTION = 0.5;
const TEMPO_MULTIPLES = [0.5, 1, 2] as const;

const isConfident = (analysis: TrackAnalysis) => analysis.confidence >= MIN_CONFIDENCE;

/** The multiple of the incoming beat that matches the outgoing tempo, or null when none does. */
function tempoMatch(outgoing: TrackAnalysis, incoming: TrackAnalysis) {
  let best: { multiple: number; rate: number } | null = null;

  for (const multiple of TEMPO_MULTIPLES) {
    const rate = (incoming.period * multiple) / outgoing.period;

    if (
      Math.abs(rate - 1) <= MAX_RATE_CHANGE &&
      (!best || Math.abs(rate - 1) < Math.abs(best.rate - 1))
    ) {
      best = { multiple, rate };
    }
  }

  return best;
}

/** The last bar line of a song at or before `time`. */
function barAtOrBefore(analysis: TrackAnalysis, time: number) {
  const bar = analysis.period * BEATS_PER_BAR;

  return analysis.firstBeat + Math.floor((time - analysis.firstBeat) / bar) * bar;
}

/**
 * Plans a DJ-style transition: when both songs keep a clear, close tempo, the next song comes in
 * on a bar line at the same tempo. Otherwise it is a crossfade timed to the end of the music.
 */
export function planMix(outgoing: TrackAnalysis, incoming: TrackAnalysis): MixPlan {
  const match =
    isConfident(outgoing) && isConfident(incoming) ? tempoMatch(outgoing, incoming) : null;
  const minStart = outgoing.duration * MIN_START_FRACTION;
  const end = Math.min(outgoing.outroEnd, outgoing.duration);

  if (!match) {
    const seconds = Math.min(FALLBACK_SECONDS, end - minStart);
    const target = end - seconds;
    const startAt = isConfident(outgoing) ? barAtOrBefore(outgoing, target) : target;

    return {
      startAt: Math.max(minStart, startAt),
      seconds: Math.max(0, seconds),
      incomingStartAt: incoming.introStart,
      rate: 1,
      beats: null,
    };
  }

  const beatCount = MIX_BEATS * outgoing.period <= MAX_MIX_SECONDS ? MIX_BEATS : SHORT_MIX_BEATS;
  const seconds = beatCount * outgoing.period;
  const startAt = Math.max(minStart, barAtOrBefore(outgoing, end - seconds));

  return {
    startAt,
    seconds: Math.min(seconds, outgoing.duration - startAt),
    incomingStartAt: incoming.introStart,
    rate: match.rate,
    beats: {
      outgoing: { offset: outgoing.firstBeat, period: outgoing.period },
      incoming: { offset: incoming.firstBeat, period: incoming.period * match.multiple },
    },
  };
}

/**
 * How far the incoming beat is ahead of the outgoing one, in real seconds, wrapped to half a
 * beat either way. The engine nudges the playback rate to bring it to zero.
 */
export function beatError(
  beats: NonNullable<MixPlan['beats']>,
  outgoingTime: number,
  incomingTime: number,
) {
  const outPhase = (outgoingTime - beats.outgoing.offset) / beats.outgoing.period;
  const inPhase = (incomingTime - beats.incoming.offset) / beats.incoming.period;
  const difference = inPhase - outPhase;
  const wrapped = difference - Math.round(difference);

  return wrapped * beats.outgoing.period;
}
