import { afterEach, describe, expect, test } from 'vitest';

import { readDismissed, rememberDismissed } from '../dismissed.ts';

afterEach(() => {
  localStorage.clear();
});

describe('dismissed announcements', () => {
  test('are remembered on this device, newest first, without duplicates', () => {
    expect(readDismissed()).toEqual([]);
    rememberDismissed('a');
    rememberDismissed('b');
    rememberDismissed('a');

    expect(readDismissed()).toEqual(['a', 'b']);
  });

  test('a corrupted entry reads as nothing dismissed', () => {
    localStorage.setItem('lyra.dismissedAnnouncements', '{"nope": true}');

    expect(readDismissed()).toEqual([]);
  });
});
