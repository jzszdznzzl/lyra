import type { Track } from '@lyra/shared';

export const RepeatMode = Object.freeze({ Off: 'off', All: 'all', One: 'one' } as const);

export type RepeatMode = (typeof RepeatMode)[keyof typeof RepeatMode];

export interface QueueState {
  queue: Track[];
  index: number;
}

/** Index to play after the current one, or null when the queue is over. */
export function nextIndex({ queue, index }: QueueState, repeat: RepeatMode, isUserAction: boolean) {
  // "Repeat one" loops on its own, but pressing next still moves on.
  if (repeat === RepeatMode.One && !isUserAction) {
    return index;
  }

  if (index + 1 < queue.length) {
    return index + 1;
  }

  return repeat === RepeatMode.Off || queue.length === 0 ? null : 0;
}

export function previousIndex({ queue, index }: QueueState, repeat: RepeatMode) {
  if (index > 0) {
    return index - 1;
  }

  return repeat === RepeatMode.All && queue.length > 0 ? queue.length - 1 : 0;
}

/** A Fisher-Yates shuffled copy. */
export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];

  for (let position = result.length - 1; position > 0; position -= 1) {
    const other = Math.floor(random() * (position + 1));
    const value = result[position];
    const swap = result[other];

    if (value !== undefined && swap !== undefined) {
      result[position] = swap;
      result[other] = value;
    }
  }

  return result;
}

/** Shuffles everything after keeping the current track first, so playback does not jump. */
export function shuffleQueue({ queue, index }: QueueState, random = Math.random): QueueState {
  const current = queue[index];
  const rest = shuffled(
    queue.filter((_, position) => position !== index),
    random,
  );

  return { queue: current ? [current, ...rest] : rest, index: 0 };
}

/**
 * Radio songs to add: without songs already queued or heard recently, and shuffled, since
 * YouTube returns the same radio in the same order every time.
 */
export function freshRadio(
  candidates: readonly Track[],
  exclude: ReadonlySet<string>,
  random = Math.random,
): Track[] {
  const seen = new Set(exclude);
  const unique = candidates.filter((track) => {
    if (seen.has(track.id)) {
      return false;
    }

    seen.add(track.id);

    return true;
  });

  return shuffled(unique, random);
}

/** The song whose radio continues the queue: one of the last few, so the radio drifts. */
export function radioSeed(queue: readonly Track[], spread: number, random = Math.random) {
  const tail = queue.slice(-Math.max(1, spread));

  return tail[Math.floor(random() * tail.length)] ?? null;
}

/** Puts tracks right after the current one. */
export function insertNext({ queue, index }: QueueState, tracks: Track[]): QueueState {
  return { queue: [...queue.slice(0, index + 1), ...tracks, ...queue.slice(index + 1)], index };
}

export function removeAt({ queue, index }: QueueState, position: number): QueueState {
  if (position < 0 || position >= queue.length) {
    return { queue, index };
  }

  const next = queue.filter((_, current) => current !== position);
  const shifted = position < index ? index - 1 : index;

  return { queue: next, index: Math.min(shifted, Math.max(0, next.length - 1)) };
}

export function moveItem({ queue, index }: QueueState, from: number, to: number): QueueState {
  if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) {
    return { queue, index };
  }

  const next = [...queue];
  const [item] = next.splice(from, 1);

  if (!item) {
    return { queue, index };
  }

  next.splice(to, 0, item);

  let current = index;

  if (from === index) {
    current = to;
  } else if (from < index && to >= index) {
    current = index - 1;
  } else if (from > index && to <= index) {
    current = index + 1;
  }

  return { queue: next, index: current };
}
