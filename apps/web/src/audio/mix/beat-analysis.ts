/** What a DJ needs to know about a song to mix it into the next one. */
export interface TrackAnalysis {
  duration: number;
  bpm: number;
  // Seconds between beats.
  period: number;
  // A downbeat (first beat of a bar); every bar starts at firstBeat + n * 4 * period.
  firstBeat: number;
  // The first bar with music, after any silence or quiet intro.
  introStart: number;
  // Where the last loud bar ends, before a fade out or silence.
  outroEnd: number;
  // How clearly the song keeps a steady beat: about 1 is noise, 2 and above is a clear pulse.
  confidence: number;
}

// Hop between envelope frames, in samples: about 12 ms at the analysis rate.
const HOP = 128;
const MIN_BPM = 60;
const MAX_BPM = 200;
// Songs are most likely near this tempo; it settles half and double tempo ambiguity.
const PRIOR_BPM = 110;
const PRIOR_OCTAVES = 1;
const LOW_CUTOFF_HZ = 150;
const HIGH_CUTOFF_HZ = 2000;
// Moving average subtracted from the onset curve, so only sudden rises count.
const ONSET_MEAN_SECONDS = 0.4;
// Fine search around the coarse tempo, as a fraction of the period.
const REFINE_SPAN = 0.03;
const REFINE_STEPS = 120;
const BEATS_PER_BAR = 4;
const INTRO_ENERGY = 0.3;
const OUTRO_ENERGY = 0.5;

const onePoleAlpha = (cutoff: number, sampleRate: number) =>
  1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);

/** Energy per frame of the low (kick, bass) and high (hats, snare) bands, and of the whole. */
function bandEnergies(samples: Float32Array, sampleRate: number) {
  const frames = Math.floor(samples.length / HOP);
  const low = new Float32Array(frames);
  const high = new Float32Array(frames);
  const full = new Float32Array(frames);
  const lowAlpha = onePoleAlpha(LOW_CUTOFF_HZ, sampleRate);
  const highAlpha = onePoleAlpha(HIGH_CUTOFF_HZ, sampleRate);
  let lowState = 0;
  let midState = 0;

  for (let frame = 0; frame < frames; frame += 1) {
    let lowSum = 0;
    let highSum = 0;
    let fullSum = 0;

    for (let offset = 0; offset < HOP; offset += 1) {
      const sample = samples[frame * HOP + offset] ?? 0;
      lowState += lowAlpha * (sample - lowState);
      midState += highAlpha * (sample - midState);
      const highPart = sample - midState;
      lowSum += lowState * lowState;
      highSum += highPart * highPart;
      fullSum += sample * sample;
    }

    low[frame] = lowSum;
    high[frame] = highSum;
    full[frame] = fullSum;
  }

  return { low, high, full };
}

/** Rises in loudness (log energy), with the slow trend removed. */
function onsetCurve(energy: Float32Array, fps: number) {
  let total = 0;

  for (const value of energy) {
    total += value;
  }

  const floor = (total / Math.max(1, energy.length)) * 1e-3 + 1e-12;
  const rises = new Float32Array(energy.length);

  for (let frame = 1; frame < energy.length; frame += 1) {
    const rise =
      Math.log((energy[frame] ?? 0) + floor) - Math.log((energy[frame - 1] ?? 0) + floor);
    rises[frame] = Math.max(0, rise);
  }

  const window = Math.max(1, Math.round(ONSET_MEAN_SECONDS * fps));
  const onset = new Float32Array(rises.length);
  let running = 0;

  for (let frame = 0; frame < rises.length; frame += 1) {
    running += rises[frame] ?? 0;

    if (frame >= window) {
      running -= rises[frame - window] ?? 0;
    }

    onset[frame] = Math.max(0, (rises[frame] ?? 0) - running / Math.min(frame + 1, window));
  }

  return onset;
}

function valueAt(curve: Float32Array, position: number) {
  const index = Math.floor(position);
  const fraction = position - index;

  return (curve[index] ?? 0) * (1 - fraction) + (curve[index + 1] ?? 0) * fraction;
}

/** Sum of the curve on a grid of beats: high when the grid lands on the onsets. */
function combScore(curve: Float32Array, period: number, phase: number, step = 1) {
  let score = 0;
  let count = 0;

  for (let position = phase; position < curve.length; position += period * step) {
    score += valueAt(curve, position);
    count += 1;
  }

  return count > 0 ? score / count : 0;
}

/** The tempo (as a period in frames) that best repeats the onsets, favouring common tempos. */
function coarsePeriod(onset: Float32Array, fps: number) {
  const minLag = Math.floor((60 * fps) / MAX_BPM);
  const maxLag = Math.ceil((60 * fps) / MIN_BPM);
  const priorLag = (60 * fps) / PRIOR_BPM;
  let bestLag = minLag;
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;

    for (let frame = lag; frame < onset.length; frame += 1) {
      sum += (onset[frame] ?? 0) * (onset[frame - lag] ?? 0);
    }

    const octaves = Math.log2(lag / priorLag) / PRIOR_OCTAVES;
    const score = (sum / (onset.length - lag)) * Math.exp(-0.5 * octaves * octaves);

    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  return bestLag;
}

/** The exact period and the phase of the beat grid that fits the onsets best. */
function refineGrid(onset: Float32Array, coarse: number) {
  let best = { period: coarse, phase: 0, score: -Infinity };
  let phaseTotal = 0;
  let phaseCount = 0;

  for (let step = 0; step <= REFINE_STEPS; step += 1) {
    const period = coarse * (1 - REFINE_SPAN + (2 * REFINE_SPAN * step) / REFINE_STEPS);

    for (let phase = 0; phase < period; phase += 1) {
      const score = combScore(onset, period, phase);
      phaseTotal += score;
      phaseCount += 1;

      if (score > best.score) {
        best = { period, phase, score };
      }
    }
  }

  const mean = phaseTotal / Math.max(1, phaseCount);

  return { ...best, confidence: mean > 0 ? best.score / mean : 0 };
}

/** The beat of the four in a bar where the kick hits hardest: most likely the downbeat. */
function downbeatPhase(lowOnset: Float32Array, period: number, phase: number) {
  let bestBeat = 0;
  let bestScore = -Infinity;

  for (let beat = 0; beat < BEATS_PER_BAR; beat += 1) {
    const score = combScore(lowOnset, period, phase + beat * period, BEATS_PER_BAR);

    if (score > bestScore) {
      bestScore = score;
      bestBeat = beat;
    }
  }

  return phase + bestBeat * period;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Loudness of each bar, and where the music starts and stops being loud. */
function sections(full: Float32Array, fps: number, barFrames: number, downbeat: number) {
  const bars: { start: number; energy: number }[] = [];
  const firstBar = downbeat - Math.floor(downbeat / barFrames) * barFrames;

  for (let start = firstBar; start + barFrames <= full.length; start += barFrames) {
    let sum = 0;

    for (let frame = Math.floor(start); frame < start + barFrames; frame += 1) {
      sum += full[frame] ?? 0;
    }

    bars.push({ start, energy: sum / barFrames });
  }

  const typical = median(bars.map((bar) => bar.energy));
  const intro = bars.find((bar) => bar.energy >= typical * INTRO_ENERGY);
  const outro = bars.findLast((bar) => bar.energy >= typical * OUTRO_ENERGY);

  return {
    introStart: (intro?.start ?? firstBar) / fps,
    outroEnd: outro ? (outro.start + barFrames) / fps : full.length / fps,
  };
}

/**
 * Finds the tempo, the bar grid and the loud part of a song from its mono samples. Tuned for a
 * low sample rate (around 11 kHz), which keeps a whole song small enough for a phone.
 */
export function analyzeSamples(samples: Float32Array, sampleRate: number): TrackAnalysis {
  const fps = sampleRate / HOP;
  const duration = samples.length / sampleRate;
  const { low, high, full } = bandEnergies(samples, sampleRate);
  const lowOnset = onsetCurve(low, fps);
  const highOnset = onsetCurve(high, fps);
  const onset = new Float32Array(lowOnset.length);

  for (let frame = 0; frame < onset.length; frame += 1) {
    onset[frame] = (lowOnset[frame] ?? 0) + (highOnset[frame] ?? 0);
  }

  const grid = refineGrid(onset, coarsePeriod(onset, fps));
  const downbeat = downbeatPhase(lowOnset, grid.period, grid.phase);
  const { introStart, outroEnd } = sections(full, fps, grid.period * BEATS_PER_BAR, downbeat);

  return {
    duration,
    bpm: (60 * fps) / grid.period,
    period: grid.period / fps,
    firstBeat: downbeat / fps,
    introStart,
    outroEnd,
    confidence: grid.confidence,
  };
}
