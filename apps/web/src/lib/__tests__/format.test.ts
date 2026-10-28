import { describe, expect, test } from 'vitest';

import { formatRelative } from '../format.ts';

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
