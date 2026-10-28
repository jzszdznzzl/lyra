import { z } from 'zod';
import type { Innertube } from 'youtubei.js';

import { LyricsSource, parseLrc } from '@lyra/shared';
import type { Lyrics, LyricsQuery } from '@lyra/shared';

const LRCLIB_URL = 'https://lrclib.net/api';
// LRCLIB asks clients to identify themselves.
const USER_AGENT = 'lyra (personal music player)';
const DURATION_TOLERANCE_SECONDS = 3;
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_LIMIT = 500;

const LrclibRecord = z.object({
  duration: z.number().nullable().catch(null),
  instrumental: z.boolean().catch(false),
  plainLyrics: z.string().nullable().catch(null),
  syncedLyrics: z.string().nullable().catch(null),
});

type LrclibRecord = z.infer<typeof LrclibRecord>;

function toLyrics(record: LrclibRecord): Lyrics | null {
  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics);

    if (lines.length > 0) {
      return { source: LyricsSource.Lrclib, isSynced: true, lines };
    }
  }

  if (record.plainLyrics) {
    return {
      source: LyricsSource.Lrclib,
      isSynced: false,
      lines: record.plainLyrics.split(/\r?\n/).map((text) => ({ timeMs: null, text })),
    };
  }

  return null;
}

async function lrclib(path: string, params: Record<string, string>, fetcher: typeof fetch) {
  const response = await fetcher(`${LRCLIB_URL}${path}?${new URLSearchParams(params).toString()}`, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const body: unknown = await response.json().catch(() => null);

  return body;
}

// "Song (feat. X)", "Song [with Y]", "Song - Remastered 2011": LRCLIB often files the bare title.
const TITLE_NOISE = [
  /\s*[([](?:feat\.?|ft\.?|with)\s[^)\]]*[)\]]/gi,
  /\s+-\s+.*(?:remaster|version|edit|mix).*$/i,
];

export function cleanTitle(title: string) {
  return TITLE_NOISE.reduce((text, pattern) => text.replace(pattern, ''), title).trim();
}

async function exactMatch(query: LyricsQuery, fetcher: typeof fetch) {
  const record = LrclibRecord.safeParse(
    await lrclib(
      '/get',
      {
        track_name: query.title,
        artist_name: query.artist,
        album_name: query.album,
        ...(query.duration > 0 ? { duration: String(Math.round(query.duration)) } : {}),
      },
      fetcher,
    ),
  );

  return record.success ? toLyrics(record.data) : null;
}

async function searchMatch(query: LyricsQuery, fetcher: typeof fetch) {
  const results = z
    .array(LrclibRecord)
    .safeParse(
      await lrclib('/search', { track_name: query.title, artist_name: query.artist }, fetcher),
    );
  const candidates = (results.success ? results.data : []).filter(
    (record) =>
      !record.instrumental &&
      (record.syncedLyrics || record.plainLyrics) &&
      (query.duration === 0 ||
        record.duration === null ||
        Math.abs(record.duration - query.duration) <= DURATION_TOLERANCE_SECONDS),
  );
  const best = candidates.find((record) => record.syncedLyrics) ?? candidates[0];

  return best ? toLyrics(best) : null;
}

/**
 * Tries the title as YouTube gives it, then the bare title with the main artist; for each, an
 * exact lookup and then a length-filtered search. Synced results win over plain ones.
 */
export async function findLrclibLyrics(query: LyricsQuery, fetcher: typeof fetch = fetch) {
  const bare = {
    ...query,
    title: cleanTitle(query.title),
    artist: query.artist.split(',')[0]?.trim() ?? query.artist,
  };
  const variants =
    bare.title === query.title && bare.artist === query.artist ? [query] : [query, bare];
  let plain: Lyrics | null = null;

  for (const variant of variants) {
    for (const lookup of [exactMatch, searchMatch]) {
      const lyrics = await lookup(variant, fetcher);

      if (lyrics?.isSynced) {
        return lyrics;
      }

      plain ??= lyrics;
    }
  }

  return plain;
}

async function youtubeLyrics(yt: Innertube, videoId: string): Promise<Lyrics | null> {
  const shelf = await yt.music.getLyrics(videoId).catch(() => undefined);
  const text = shelf?.description.toString() ?? '';

  return text.trim()
    ? {
        source: LyricsSource.YouTube,
        isSynced: false,
        lines: text.split(/\r?\n/).map((line) => ({ timeMs: null, text: line })),
      }
    : null;
}

/** Synced lyrics from LRCLIB when it has them, YT Music's plain lyrics otherwise. */
export class LyricsService {
  #cache = new Map<string, Lyrics | null>();
  #fetcher: typeof fetch;

  constructor(fetcher: typeof fetch = fetch) {
    this.#fetcher = fetcher;
  }

  async find(yt: Innertube, videoId: string, query: LyricsQuery) {
    if (this.#cache.has(videoId)) {
      return this.#cache.get(videoId) ?? null;
    }

    const lyrics =
      (await findLrclibLyrics(query, this.#fetcher)) ?? (await youtubeLyrics(yt, videoId));

    // Oldest entries go first; Map keeps insertion order.
    if (this.#cache.size >= CACHE_LIMIT) {
      const oldest = this.#cache.keys().next().value;

      if (oldest !== undefined) {
        this.#cache.delete(oldest);
      }
    }

    this.#cache.set(videoId, lyrics);

    return lyrics;
  }
}
