import { describe, expect, test } from 'vitest';

import type { Track } from '@lyra/shared';

import {
  insertNext,
  moveItem,
  nextIndex,
  previousIndex,
  removeAt,
  shuffleQueue,
} from '../queue.ts';

function track(id: string): Track {
  return {
    kind: 'song',
    id,
    title: id,
    artists: [],
    album: null,
    durationSeconds: 100,
    thumbnail: null,
    isExplicit: false,
  };
}

const ids = (queue: Track[]) => queue.map((item) => item.id);
const queue = ['a', 'b', 'c', 'd'].map(track);

describe('queue', () => {
  test('next respects repeat modes', () => {
    expect(nextIndex({ queue, index: 1 }, 'off', false)).toBe(2);
    expect(nextIndex({ queue, index: 3 }, 'off', false)).toBeNull();
    expect(nextIndex({ queue, index: 3 }, 'all', false)).toBe(0);
    expect(nextIndex({ queue, index: 2 }, 'one', false)).toBe(2);
    expect(nextIndex({ queue, index: 2 }, 'one', true)).toBe(3);
  });

  test('previous wraps only with repeat all', () => {
    expect(previousIndex({ queue, index: 2 }, 'off')).toBe(1);
    expect(previousIndex({ queue, index: 0 }, 'off')).toBe(0);
    expect(previousIndex({ queue, index: 0 }, 'all')).toBe(3);
  });

  test('shuffle keeps the current track first and every track once', () => {
    const shuffled = shuffleQueue({ queue, index: 2 }, () => 0);

    expect(shuffled.index).toBe(0);
    expect(shuffled.queue[0]?.id).toBe('c');
    expect(ids(shuffled.queue).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  test('insertNext places tracks after the current one', () => {
    expect(ids(insertNext({ queue, index: 1 }, [track('x')]).queue)).toEqual([
      'a',
      'b',
      'x',
      'c',
      'd',
    ]);
  });

  test('removeAt keeps pointing at the playing track', () => {
    const removed = removeAt({ queue, index: 2 }, 0);

    expect(ids(removed.queue)).toEqual(['b', 'c', 'd']);
    expect(removed.queue[removed.index]?.id).toBe('c');
  });

  test('moveItem keeps pointing at the playing track', () => {
    for (const [from, to] of [
      [0, 3],
      [3, 0],
      [2, 0],
      [1, 2],
    ] as const) {
      const moved = moveItem({ queue, index: 2 }, from, to);

      expect(moved.queue[moved.index]?.id).toBe('c');
    }
  });
});
