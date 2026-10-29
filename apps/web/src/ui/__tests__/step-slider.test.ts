import { describe, expect, test } from 'vitest';

import { stepValue } from '../step-slider.tsx';

describe('stepValue', () => {
  test('moves one step on the button grid', () => {
    expect(stepValue(0.5, 1, 0.05, 0, 1)).toBe(0.55);
    expect(stepValue(0.5, -1, 0.05, 0, 1)).toBe(0.45);
    expect(stepValue(3, 1, 1, -12, 12)).toBe(4);
  });

  test('snaps a dragged value to the grid instead of keeping its odd remainder', () => {
    expect(stepValue(0.83, 1, 0.05, 0, 1)).toBe(0.85);
    expect(stepValue(0.83, -1, 0.05, 0, 1)).toBe(0.8);
  });

  test('absorbs floating point error', () => {
    expect(stepValue(0.1 + 0.2, 1, 0.05, 0, 1)).toBe(0.35);
    expect(stepValue(0.15000000000000002, -1, 0.05, 0, 1)).toBe(0.1);
  });

  test('stays within range', () => {
    expect(stepValue(1, 1, 0.05, 0, 1)).toBe(1);
    expect(stepValue(0.02, -1, 0.05, 0, 1)).toBe(0);
    expect(stepValue(-12, -1, 1, -12, 12)).toBe(-12);
  });
});
