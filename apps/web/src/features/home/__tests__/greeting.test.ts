import { describe, expect, test } from 'vitest';

import { greetingKey } from '../greeting.ts';

describe('greetingKey', () => {
  test.each([
    [6, 'home.greeting.morning'],
    [12, 'home.greeting.afternoon'],
    [21, 'home.greeting.evening'],
    [2, 'home.greeting.evening'],
  ])('hour %i maps to %s', (hour, key) => {
    expect(greetingKey(hour)).toBe(key);
  });
});
