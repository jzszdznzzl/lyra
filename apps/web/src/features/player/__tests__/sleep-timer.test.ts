import { describe, expect, test } from 'vitest';

import { minutesLeft } from '../sleep-timer.ts';

describe('minutesLeft', () => {
  test('rounds up, so the last minute shows as 1', () => {
    expect(minutesLeft(90_000, 0)).toBe(2);
    expect(minutesLeft(10_000, 0)).toBe(1);
  });

  test('never shows 0 or less', () => {
    expect(minutesLeft(0, 5_000)).toBe(1);
  });
});
