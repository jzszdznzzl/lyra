import { describe, expect, test } from 'vitest';

import { peakIndex, utcOffsetMinutes } from '../recap.ts';

describe('peakIndex', () => {
  test('finds the largest value, the first one on a tie', () => {
    expect(peakIndex([1, 5, 3, 5])).toBe(1);
  });

  test('is null with nothing played', () => {
    expect(peakIndex([0, 0, 0])).toBeNull();
  });
});

describe('utcOffsetMinutes', () => {
  test('has the opposite sign of getTimezoneOffset', () => {
    const date = new Date();

    expect(utcOffsetMinutes(date)).toBe(-date.getTimezoneOffset());
  });
});
