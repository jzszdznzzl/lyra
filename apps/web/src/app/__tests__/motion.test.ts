import { afterEach, describe, expect, test, vi } from 'vitest';

import { Motion, applyMotion, isMotionReduced, readStoredMotion } from '../motion.ts';

function osAsksForLessMotion(isReduced: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: isReduced && query.includes('reduce'),
        addEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('motion', () => {
  test('follows the device until the user picks', () => {
    expect(readStoredMotion()).toBe(Motion.System);

    osAsksForLessMotion(true);
    applyMotion(Motion.System);
    expect(isMotionReduced()).toBe(true);

    osAsksForLessMotion(false);
    applyMotion(Motion.System);
    expect(isMotionReduced()).toBe(false);
  });

  test('an explicit choice wins over the device and is remembered', () => {
    osAsksForLessMotion(false);
    applyMotion(Motion.Off);
    expect(isMotionReduced()).toBe(true);
    expect(readStoredMotion()).toBe(Motion.Off);

    osAsksForLessMotion(true);
    applyMotion(Motion.On);
    expect(isMotionReduced()).toBe(false);
  });
});
