import { describe, expect, test } from 'vitest';

import { firstName, greetingKey } from '../greeting.ts';

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

describe('firstName', () => {
  test.each([
    ['José Daniel Cristaldo Vera', 'José'],
    ['  Ana  ', 'Ana'],
    ['', null],
    ['   ', null],
  ])('%j gives %j', (name, expected) => {
    expect(firstName(name)).toBe(expected);
  });
});
