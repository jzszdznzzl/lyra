import { z } from 'zod';

import { Track } from './music.ts';

// UTC offsets run from -12:00 to +14:00.
export const MIN_UTC_OFFSET_MINUTES = -720;
export const MAX_UTC_OFFSET_MINUTES = 840;

export const RecapQuery = z.object({
  year: z.coerce.number().int().min(2000).max(9999),
  // Minutes to add to UTC for the listener's local time, so months and hours are their own.
  offset: z.coerce.number().int().min(MIN_UTC_OFFSET_MINUTES).max(MAX_UTC_OFFSET_MINUTES),
});

export type RecapQuery = z.infer<typeof RecapQuery>;

export const RecapArtist = z.object({ name: z.string(), plays: z.number() });

export type RecapArtist = z.infer<typeof RecapArtist>;

export const RecapTrack = z.object({ track: Track, plays: z.number() });

export type RecapTrack = z.infer<typeof RecapTrack>;

/** A year of listening in Lyra, for the person who did the listening. */
export const Recap = z.object({
  year: z.number(),
  // Years with any listening, newest first, to switch between them.
  years: z.array(z.number()),
  plays: z.number(),
  // Estimated from song lengths: a play counts after 30 seconds, but most are heard whole.
  minutes: z.number(),
  songs: z.number(),
  artists: z.number(),
  topArtists: z.array(RecapArtist),
  topTracks: z.array(RecapTrack),
  // Plays in each month, January first.
  months: z.array(z.number()).length(12),
  // Plays in each hour of the day, local time.
  hours: z.array(z.number()).length(24),
  firstTrack: Track.nullable(),
  // When Lyra started counting this person's plays, so a short year is explained.
  countingSince: z.number().nullable(),
});

export type Recap = z.infer<typeof Recap>;
