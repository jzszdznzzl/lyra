import { z } from 'zod';

export const LyricsSource = Object.freeze({ Lrclib: 'lrclib', YouTube: 'youtube' } as const);

export type LyricsSource = (typeof LyricsSource)[keyof typeof LyricsSource];

export const LyricsLine = z.object({
  // Null for unsynced lyrics.
  timeMs: z.number().nullable(),
  text: z.string(),
});

export type LyricsLine = z.infer<typeof LyricsLine>;

export const Lyrics = z.object({
  source: z.enum(LyricsSource),
  isSynced: z.boolean(),
  lines: z.array(LyricsLine),
});

export type Lyrics = z.infer<typeof Lyrics>;

export const LyricsResponse = z.object({ lyrics: Lyrics.nullable() });

export type LyricsResponse = z.infer<typeof LyricsResponse>;

export const LyricsQuery = z.object({
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().max(300).default(''),
  album: z.string().trim().max(300).default(''),
  duration: z.coerce.number().min(0).max(36_000).default(0),
});

export type LyricsQuery = z.infer<typeof LyricsQuery>;

const LRC_TIMESTAMP = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

/** Parses LRC text into time-sorted lines; a line with several timestamps repeats. */
export function parseLrc(lrc: string): LyricsLine[] {
  const lines: LyricsLine[] = [];

  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(LRC_TIMESTAMP)];
    const text = raw.replace(LRC_TIMESTAMP, '').trim();

    for (const [, minutes = '0', seconds = '0'] of stamps) {
      const timeMs = Math.round((Number(minutes) * 60 + Number(seconds.replace(':', '.'))) * 1000);
      lines.push({ timeMs, text });
    }
  }

  return lines.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
}

/** Index of the line being sung at `positionMs`, or -1 before the first one. */
export function activeLineIndex(lines: LyricsLine[], positionMs: number) {
  let active = -1;

  lines.forEach((line, index) => {
    if (line.timeMs !== null && line.timeMs <= positionMs) {
      active = index;
    }
  });

  return active;
}
