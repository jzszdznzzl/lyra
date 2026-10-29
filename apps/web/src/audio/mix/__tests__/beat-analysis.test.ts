import { describe, expect, test } from 'vitest';

import { analyzeSamples } from '../beat-analysis.ts';

const SAMPLE_RATE = 11025;

/** A drum loop: a loud kick on every downbeat, softer kicks on the other beats, hats between. */
function drumLoop(bpm: number, seconds: number, startAt = 0) {
  const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  const period = 60 / bpm;

  for (let beat = 0; startAt + beat * period < seconds; beat += 1) {
    const start = Math.round((startAt + beat * period) * SAMPLE_RATE);
    const isDownbeat = beat % 4 === 0;

    // Kick: a decaying 60 Hz tone.
    for (let index = 0; index < SAMPLE_RATE * 0.15; index += 1) {
      const envelope = Math.exp(-index / (SAMPLE_RATE * 0.04)) * (isDownbeat ? 1 : 0.5);
      samples[start + index] = Math.sin((2 * Math.PI * 60 * index) / SAMPLE_RATE) * envelope;
    }

    // Hat on the off-beat: a short burst of noise.
    const hat = Math.round(start + (period / 2) * SAMPLE_RATE);

    for (let index = 0; index < SAMPLE_RATE * 0.02; index += 1) {
      samples[hat + index] = (Math.random() * 2 - 1) * 0.2 * Math.exp(-index / 40);
    }
  }

  return samples;
}

describe('analyzeSamples', () => {
  test.each([90, 100, 124, 128])('finds %i BPM', (bpm) => {
    const analysis = analyzeSamples(drumLoop(bpm, 60), SAMPLE_RATE);

    expect(analysis.bpm).toBeCloseTo(bpm, 0);
    expect(analysis.confidence).toBeGreaterThan(2);
  });

  test('puts the grid on the downbeats', () => {
    const bpm = 120;
    const analysis = analyzeSamples(drumLoop(bpm, 60, 0.5), SAMPLE_RATE);
    const bar = (60 / bpm) * 4;
    const offset = (analysis.firstBeat - 0.5) / bar;

    expect(Math.abs(offset - Math.round(offset))).toBeLessThan(0.02);
  });

  test('finds where the music starts and ends', () => {
    const music = drumLoop(120, 40);
    const samples = new Float32Array(Math.round(60 * SAMPLE_RATE));
    // 10 s of silence, 40 s of music, 10 s of silence.
    samples.set(music, 10 * SAMPLE_RATE);
    const analysis = analyzeSamples(samples, SAMPLE_RATE);

    expect(analysis.introStart).toBeGreaterThan(9);
    expect(analysis.introStart).toBeLessThan(12);
    expect(analysis.outroEnd).toBeGreaterThan(48);
    expect(analysis.outroEnd).toBeLessThan(52);
  });

  test('has low confidence without a steady beat', () => {
    const noise = new Float32Array(30 * SAMPLE_RATE).map(() => (Math.random() * 2 - 1) * 0.3);

    expect(analyzeSamples(noise, SAMPLE_RATE).confidence).toBeLessThan(2);
  });
});
