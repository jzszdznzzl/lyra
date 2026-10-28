import { describe, expect, test } from 'vitest';

import { formatDuration, formatRelative } from '../format.ts';

describe('formatRelative', () => {
  const now = Date.UTC(2026, 9, 27, 12);

  test('formats past times in each language', () => {
    expect(formatRelative(now - 3 * 60 * 1000, 'en', now)).toBe('3 minutes ago');
    expect(formatRelative(now - 2 * 24 * 60 * 60 * 1000, 'es', now)).toBe('anteayer');
  });

  test('treats the last seconds as now', () => {
    expect(formatRelative(now - 5000, 'en', now)).toBe('now');
  });
});

describe('formatDuration', () => {
  test.each([
    [5, '0:05'],
    [225, '3:45'],
    [3723, '1:02:03'],
  ])('%i seconds', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
