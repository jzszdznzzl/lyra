import { describe, expect, test } from 'bun:test';

import { RateLimiter } from '../rate-limiter.ts';

describe('RateLimiter', () => {
  test('blocks after the limit and resets after the window', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);

    expect(limiter.hit('ip')).toBe(true);
    expect(limiter.hit('ip')).toBe(true);
    expect(limiter.hit('ip')).toBe(false);
    expect(limiter.hit('other')).toBe(true);

    now = 1000;
    expect(limiter.hit('ip')).toBe(true);
  });
});
