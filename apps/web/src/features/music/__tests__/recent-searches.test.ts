import { beforeEach, describe, expect, test } from 'vitest';

import { useRecentSearches } from '../recent-searches.ts';

beforeEach(() => {
  useRecentSearches.getState().clear();
});

describe('recent searches', () => {
  test('keeps the newest first without duplicates', () => {
    const { add } = useRecentSearches.getState();
    add('daft punk');
    add('queen');
    add('Daft Punk');

    expect(useRecentSearches.getState().queries).toEqual(['Daft Punk', 'queen']);
    expect(JSON.parse(localStorage.getItem('lyra.recent-searches') ?? '[]')).toEqual([
      'Daft Punk',
      'queen',
    ]);
  });

  test('caps the list and ignores blank queries', () => {
    const { add } = useRecentSearches.getState();

    for (let index = 0; index < 15; index += 1) {
      add(`query ${index}`);
    }

    add('   ');

    expect(useRecentSearches.getState().queries).toHaveLength(10);
    expect(useRecentSearches.getState().queries[0]).toBe('query 14');
  });
});
