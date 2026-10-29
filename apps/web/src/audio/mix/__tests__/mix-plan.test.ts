import { describe, expect, test } from 'vitest';

import { beatError, planMix } from '../mix-plan.ts';
import type { TrackAnalysis } from '../beat-analysis.ts';

function analysis(patch: Partial<TrackAnalysis>): TrackAnalysis {
  const bpm = patch.bpm ?? 120;

  return {
    duration: 200,
    bpm,
    period: 60 / bpm,
    firstBeat: 0,
    introStart: 0,
    outroEnd: 196,
    confidence: 4,
    ...patch,
  };
}

describe('planMix', () => {
  test('matches close tempos on a bar line, ending where the music ends', () => {
    const plan = planMix(analysis({ bpm: 120 }), analysis({ bpm: 124, introStart: 2 }));
    const bar = 2;

    expect(plan.beats).not.toBeNull();
    // The incoming song slows down to the outgoing tempo.
    expect(plan.rate).toBeCloseTo(120 / 124, 3);
    expect(plan.seconds).toBeCloseTo(8);
    expect(plan.startAt % bar).toBeCloseTo(0);
    expect(plan.startAt + plan.seconds).toBeLessThanOrEqual(196);
    expect(plan.incomingStartAt).toBe(2);
  });

  test('matches double and half tempo', () => {
    const plan = planMix(analysis({ bpm: 85 }), analysis({ bpm: 171 }));

    expect(plan.beats).not.toBeNull();
    expect(plan.rate).toBeCloseTo(170 / 171, 3);
  });

  test('falls back to a crossfade when the tempos are far apart', () => {
    const plan = planMix(analysis({ bpm: 96 }), analysis({ bpm: 132 }));

    expect(plan.beats).toBeNull();
    expect(plan.rate).toBe(1);
    expect(plan.seconds).toBe(6);
  });

  test('falls back to a crossfade when a tempo is a guess', () => {
    const plan = planMix(analysis({ confidence: 1.5 }), analysis({}));

    expect(plan.beats).toBeNull();
  });

  test('never starts in the first half of the song', () => {
    const plan = planMix(analysis({ outroEnd: 50 }), analysis({}));

    expect(plan.startAt).toBeGreaterThanOrEqual(100);
  });
});

describe('beatError', () => {
  const beats = {
    outgoing: { offset: 0, period: 0.5 },
    incoming: { offset: 1, period: 0.5 },
  };

  test('is zero when the beats line up', () => {
    expect(beatError(beats, 10, 3)).toBeCloseTo(0);
  });

  test('is positive when the incoming song is ahead', () => {
    expect(beatError(beats, 10, 3.05)).toBeCloseTo(0.05);
  });

  test('wraps to the nearest beat', () => {
    expect(beatError(beats, 10, 3.45)).toBeCloseTo(-0.05);
  });
});
