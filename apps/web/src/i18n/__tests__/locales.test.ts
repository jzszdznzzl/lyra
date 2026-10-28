import { describe, expect, test } from 'vitest';

import en from '../en.json';
import es from '../es.json';

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('locales', () => {
  test('spanish has exactly the english keys', () => {
    expect(keysOf(es).sort()).toEqual(keysOf(en).sort());
  });
});
