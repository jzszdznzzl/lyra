import { describe, expect, test } from 'vitest';

import { limiterMakeupCompensation, normalizationGain, parseLoudness } from '../loudness.ts';

const toDb = (gain: number) => 20 * Math.log10(gain);

describe('normalizationGain', () => {
  test('leaves songs alone when the measure is unknown', () => {
    expect(normalizationGain(null, true)).toBe(1);
  });

  test('turns loud songs down by their loudness', () => {
    expect(toDb(normalizationGain(4, true))).toBeCloseTo(-4);
  });

  test('raises quiet songs only with the limiter, and at most 6 dB', () => {
    expect(normalizationGain(-3, false)).toBe(1);
    expect(toDb(normalizationGain(-3, true))).toBeCloseTo(3);
    expect(toDb(normalizationGain(-20, true))).toBeCloseTo(6);
  });

  test('cuts at most 12 dB', () => {
    expect(toDb(normalizationGain(30, true))).toBeCloseTo(-12);
  });
});

describe('limiterMakeupCompensation', () => {
  test('undoes the makeup gain Web Audio adds', () => {
    // At -1 dB and 20:1, 0 dBFS comes out at -0.95 dB, so makeup is 0.57 dB.
    expect(toDb(limiterMakeupCompensation(-1, 20))).toBeCloseTo(-0.57, 2);
  });
});

describe('parseLoudness', () => {
  test.each([
    ['-3.5', -3.5],
    ['2', 2],
    [null, null],
    ['', null],
    ['abc', null],
  ])('%j gives %j', (header, expected) => {
    expect(parseLoudness(header)).toBe(expected);
  });
});
