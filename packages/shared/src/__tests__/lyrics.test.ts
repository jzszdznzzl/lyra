import { describe, expect, test } from 'bun:test';

import { activeLineIndex, parseLrc } from '../lyrics.ts';

describe('lyrics', () => {
  test('parses LRC timestamps, including repeated lines', () => {
    const lines = parseLrc(
      '[ti:Song]\n[00:01.50]Hello\n[00:10.00][00:30.25]Chorus\n[00:20.5]Verse',
    );

    expect(lines).toEqual([
      { timeMs: 1500, text: 'Hello' },
      { timeMs: 10_000, text: 'Chorus' },
      { timeMs: 20_500, text: 'Verse' },
      { timeMs: 30_250, text: 'Chorus' },
    ]);
  });

  test('finds the line being sung', () => {
    const lines = parseLrc('[00:01.00]a\n[00:05.00]b');

    expect(activeLineIndex(lines, 500)).toBe(-1);
    expect(activeLineIndex(lines, 4999)).toBe(0);
    expect(activeLineIndex(lines, 5000)).toBe(1);
  });
});
