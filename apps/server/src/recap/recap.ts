import { and, eq, gte, lt, min, sql } from 'drizzle-orm';
import { z } from 'zod';

import { MediaKind } from '@lyra/shared';
import type { Recap, RecapTrack, Track } from '@lyra/shared';

import { schema } from '../db/index.ts';
import type { AppContext } from '../context.ts';

export interface PlayRow {
  videoId: string;
  title: string | null;
  artists: unknown;
  durationSeconds: number | null;
  playedAt: number;
}

const ArtistNames = z.array(z.string());
const YearRow = z.object({ year: z.number().int() });

const TOP_ARTISTS = 5;
const TOP_TRACKS = 10;
const MINUTE_MS = 60_000;
const MONTHS = 12;
const HOURS = 24;

const artistNames = (row: PlayRow) => {
  const parsed = ArtistNames.safeParse(row.artists);

  return parsed.success ? parsed.data : [];
};

/** Plays only keep names and the video id; the cover is YouTube's thumbnail for that id. */
function toTrack(row: PlayRow): Track | null {
  if (row.title === null) {
    return null;
  }

  return {
    kind: MediaKind.Song,
    id: row.videoId,
    title: row.title,
    artists: artistNames(row).map((name) => ({ id: null, name })),
    album: null,
    durationSeconds: row.durationSeconds,
    thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(row.videoId)}/hqdefault.jpg`,
    isExplicit: false,
  };
}

/** Most played first; ties go to whoever was heard first, so the order is stable. */
function ranked<T>(counts: Map<string, { value: T; plays: number; first: number }>, limit: number) {
  return [...counts.values()]
    .sort((a, b) => b.plays - a.plays || a.first - b.first)
    .slice(0, limit);
}

/** Local midnight on 1 January of `year`, as a UTC timestamp. */
export function yearStart(year: number, offsetMinutes: number) {
  return Date.UTC(year, 0, 1) - offsetMinutes * MINUTE_MS;
}

/** Totals, favourites and when the listening happened, from one year of plays. */
export function buildRecap(
  rows: readonly PlayRow[],
  year: number,
  offsetMinutes: number,
): Omit<Recap, 'years' | 'countingSince'> {
  const sorted = [...rows].sort((a, b) => a.playedAt - b.playedAt);
  const artists = new Map<string, { value: string; plays: number; first: number }>();
  const tracks = new Map<string, { value: Track; plays: number; first: number }>();
  const months = Array.from({ length: MONTHS }, () => 0);
  const hours = Array.from({ length: HOURS }, () => 0);
  let seconds = 0;

  for (const row of sorted) {
    const local = new Date(row.playedAt + offsetMinutes * MINUTE_MS);
    months[local.getUTCMonth()] = (months[local.getUTCMonth()] ?? 0) + 1;
    hours[local.getUTCHours()] = (hours[local.getUTCHours()] ?? 0) + 1;
    seconds += row.durationSeconds ?? 0;

    for (const name of artistNames(row)) {
      const artist = artists.get(name) ?? { value: name, plays: 0, first: row.playedAt };
      artist.plays += 1;
      artists.set(name, artist);
    }

    const track = tracks.get(row.videoId);

    if (track) {
      track.plays += 1;
    } else {
      const value = toTrack(row);

      if (value) {
        tracks.set(row.videoId, { value, plays: 1, first: row.playedAt });
      }
    }
  }

  const firstWithTitle = sorted.find((row) => row.title !== null);

  return {
    year,
    plays: sorted.length,
    minutes: Math.round(seconds / 60),
    songs: new Set(sorted.map((row) => row.videoId)).size,
    artists: artists.size,
    topArtists: ranked(artists, TOP_ARTISTS).map(({ value, plays }) => ({ name: value, plays })),
    topTracks: ranked(tracks, TOP_TRACKS).map(({ value, plays }): RecapTrack => ({
      track: value,
      plays,
    })),
    months,
    hours,
    firstTrack: firstWithTitle ? toTrack(firstWithTitle) : null,
  };
}

/** One person's year, read from the plays Lyra counts for its statistics. */
export async function recapFor(
  ctx: AppContext,
  userId: string,
  year: number,
  offsetMinutes: number,
): Promise<Recap> {
  const from = yearStart(year, offsetMinutes);
  const to = yearStart(year + 1, offsetMinutes);
  const rows = await ctx.db
    .select()
    .from(schema.plays)
    .where(
      and(
        eq(schema.plays.userId, userId),
        gte(schema.plays.playedAt, from),
        lt(schema.plays.playedAt, to),
      ),
    );
  const localYear = sql<number>`cast(strftime('%Y', ${schema.plays.playedAt} / 1000 + ${offsetMinutes * 60}, 'unixepoch') as integer)`;
  const yearRows = await ctx.db
    .select({ year: localYear })
    .from(schema.plays)
    .where(eq(schema.plays.userId, userId))
    .groupBy(localYear);
  const [since] = await ctx.db
    .select({ at: min(schema.plays.playedAt) })
    .from(schema.plays)
    .where(eq(schema.plays.userId, userId));
  const years = yearRows
    .flatMap((row) => {
      const parsed = YearRow.safeParse(row);

      return parsed.success ? [parsed.data.year] : [];
    })
    .sort((a, b) => b - a);

  return {
    ...buildRecap(rows, year, offsetMinutes),
    years,
    countingSince: since?.at ?? null,
  };
}
