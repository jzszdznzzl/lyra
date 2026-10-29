import { afterEach, describe, expect, test } from 'vitest';

import { pageTransition } from '../page-transitions.ts';

afterEach(() => {
  delete document.documentElement.dataset['motion'];
});

describe('pageTransition', () => {
  test('animates real page changes only', () => {
    expect(pageTransition({ fromLocation: '/', pathChanged: true })).toEqual(['page']);
    // Opening or closing an overlay, or typing a search, keeps the path.
    expect(pageTransition({ fromLocation: '/', pathChanged: false })).toBe(false);
  });

  test('does not animate the first page of a load', () => {
    expect(pageTransition({ pathChanged: true })).toBe(false);
  });

  test('never animates with motion turned off', () => {
    document.documentElement.dataset['motion'] = 'reduced';

    expect(pageTransition({ fromLocation: '/', pathChanged: true })).toBe(false);
  });
});
