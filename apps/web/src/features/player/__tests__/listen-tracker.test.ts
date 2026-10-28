import { describe, expect, test } from 'vitest';

import { ListenTracker } from '../listen-tracker.ts';

/** Plays `trackId` from `from` to `to` in quarter-second steps; returns how many listens fired. */
function play(tracker: ListenTracker, trackId: string, from: number, to: number, duration = 200) {
  let listens = 0;

  for (let position = from; position <= to; position += 0.25) {
    if (tracker.update(trackId, position, duration)) {
      listens += 1;
    }
  }

  return listens;
}

describe('ListenTracker', () => {
  test('counts a song once after 30 seconds heard', () => {
    const tracker = new ListenTracker();

    expect(play(tracker, 'a', 0, 29.5)).toBe(0);
    expect(play(tracker, 'a', 29.75, 120)).toBe(1);
  });

  test('a short song counts at half its length', () => {
    const tracker = new ListenTracker();

    expect(play(tracker, 'a', 0, 9.5, 20)).toBe(0);
    expect(play(tracker, 'a', 9.75, 12, 20)).toBe(1);
  });

  test('seeking forward does not count as listening', () => {
    const tracker = new ListenTracker();
    play(tracker, 'a', 0, 5);

    expect(play(tracker, 'a', 150, 160)).toBe(0);
  });

  test('a new song, or the same one from the start, is a new play', () => {
    const tracker = new ListenTracker();
    expect(play(tracker, 'a', 0, 40)).toBe(1);
    expect(play(tracker, 'b', 0, 40)).toBe(1);
    expect(play(tracker, 'b', 0, 40)).toBe(1);
  });
});
