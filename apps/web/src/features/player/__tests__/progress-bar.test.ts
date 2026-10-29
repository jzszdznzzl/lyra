import { describe, expect, test } from 'vitest';

import { progressPercent } from '../progress-bar.tsx';

describe('progressPercent', () => {
  test('is the share of the song played', () => {
    expect(progressPercent(30, 120)).toBe(25);
  });

  test('never runs past either end, even with a stale position', () => {
    expect(progressPercent(360, 120)).toBe(100);
    expect(progressPercent(-5, 120)).toBe(0);
  });

  test('is zero while the length is unknown', () => {
    expect(progressPercent(30, 0)).toBe(0);
  });
});
