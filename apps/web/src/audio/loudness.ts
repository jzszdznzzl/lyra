import { LOUDNESS_HEADER } from '@lyra/shared';

// Quiet songs are raised at most this much, and only while the limiter catches the peaks.
const MAX_BOOST_DB = 6;
const MAX_CUT_DB = 12;

/** Limiter settings: transparent below the threshold, a hard ceiling above it. */
export const LIMITER_THRESHOLD_DB = -1;
export const LIMITER_RATIO = 20;
export const LIMITER_ATTACK_SECONDS = 0.003;
export const LIMITER_RELEASE_SECONDS = 0.25;

const dbToGain = (db: number) => 10 ** (db / 20);

/**
 * The gain that brings a song to YouTube's reference loudness. `loudnessDb` is how much louder
 * than the reference the song is, so a positive value turns it down.
 */
export function normalizationGain(loudnessDb: number | null, canBoost: boolean) {
  if (loudnessDb === null) {
    return 1;
  }

  const maxBoost = canBoost ? MAX_BOOST_DB : 0;

  return dbToGain(Math.min(maxBoost, Math.max(-MAX_CUT_DB, -loudnessDb)));
}

/**
 * The gain that undoes the compressor's automatic makeup gain. Web Audio raises the whole signal
 * by (1 / gain at 0 dBFS) ^ 0.6, so without this the limiter would also make quiet parts louder.
 */
export function limiterMakeupCompensation(thresholdDb: number, ratio: number) {
  const fullRangeDb = thresholdDb - thresholdDb / ratio;
  const makeup = (1 / dbToGain(fullRangeDb)) ** 0.6;

  return 1 / makeup;
}

/** Null when the header is missing or not a number. */
export function parseLoudness(header: string | null) {
  if (header === null || header.trim() === '') {
    return null;
  }

  const value = Number(header);

  return Number.isFinite(value) ? value : null;
}

/**
 * YouTube's loudness measure for a stream, read from a one-byte request. Downloaded songs answer
 * from the service worker with the value stored at download time.
 */
export async function fetchLoudness(url: string) {
  try {
    const response = await fetch(url, {
      headers: { range: 'bytes=0-0' },
      credentials: 'same-origin',
    });
    await response.body?.cancel();

    return response.ok ? parseLoudness(response.headers.get(LOUDNESS_HEADER)) : null;
  } catch {
    return null;
  }
}
