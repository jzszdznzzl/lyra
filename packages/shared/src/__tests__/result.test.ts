import { describe, expect, test } from 'bun:test';

import { err, ok } from '../result.ts';

describe('result', () => {
  test('ok carries data and no error', () => {
    expect(ok(5)).toEqual({ data: 5, error: null });
  });

  test('err carries error and no data', () => {
    expect(err('nope')).toEqual({ data: null, error: 'nope' });
  });
});
