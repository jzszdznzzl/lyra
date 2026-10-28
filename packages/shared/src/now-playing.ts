import { z } from 'zod';

import { DeviceKind } from './connect.ts';

export const NowPlayingTrack = z.object({
  id: z.string(),
  title: z.string(),
  artists: z.array(z.object({ id: z.string().nullable(), name: z.string() })),
  album: z.object({ id: z.string().nullable(), name: z.string() }).nullable(),
  durationMs: z.number().nullable(),
  // Absolute URLs, so clients outside lyra (Discord, a website) can use them as they are.
  coverUrl: z.string().nullable(),
  url: z.string(),
  youtubeMusicUrl: z.string(),
});

export type NowPlayingTrack = z.infer<typeof NowPlayingTrack>;

/**
 * The song playing now, or the last one heard. While `isPlaying`, the position at any moment is
 * `progressMs + (now - updatedAt)`, so clients can draw a progress bar without polling.
 */
export const NowPlaying = z.object({
  isPlaying: z.boolean(),
  track: NowPlayingTrack,
  progressMs: z.number(),
  // Server time (ms) when `progressMs` was true; for a stopped song, when it was last heard.
  updatedAt: z.number(),
  device: z.object({ name: z.string(), kind: z.enum(DeviceKind) }).nullable(),
});

export type NowPlaying = z.infer<typeof NowPlaying>;
