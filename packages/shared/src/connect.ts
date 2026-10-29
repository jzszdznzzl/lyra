import { z } from 'zod';

import { Track } from './music.ts';

export const DeviceKind = Object.freeze({ Desktop: 'desktop', Mobile: 'mobile' } as const);

export type DeviceKind = (typeof DeviceKind)[keyof typeof DeviceKind];

export const Repeat = Object.freeze({ Off: 'off', All: 'all', One: 'one' } as const);

export type Repeat = (typeof Repeat)[keyof typeof Repeat];

export const MAX_SHARED_QUEUE = 500;

export const Device = z.object({
  id: z.string().min(8).max(64),
  name: z.string().min(1).max(60),
  kind: z.enum(DeviceKind),
});

export type Device = z.infer<typeof Device>;

/** What the active device is doing; every other device mirrors it. */
export const PlaybackState = z.object({
  queue: z.array(Track).max(MAX_SHARED_QUEUE),
  index: z.number().int().min(0),
  positionMs: z.number().min(0),
  // Server time when `positionMs` was true, so others can extrapolate while it plays.
  updatedAt: z.number(),
  isPlaying: z.boolean(),
  volume: z.number().min(0).max(1),
  repeat: z.enum(Repeat),
  isShuffled: z.boolean(),
});

export type PlaybackState = z.infer<typeof PlaybackState>;

export const Command = z.discriminatedUnion('type', [
  z.object({ type: z.literal('play') }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('previous') }),
  z.object({ type: z.literal('seek'), positionMs: z.number().min(0) }),
  z.object({ type: z.literal('volume'), volume: z.number().min(0).max(1) }),
  z.object({ type: z.literal('jump'), index: z.number().int().min(0) }),
  z.object({
    type: z.literal('playTracks'),
    tracks: z.array(Track).min(1).max(MAX_SHARED_QUEUE),
    index: z.number().int().min(0),
  }),
  // Plays the track followed by a freshly shuffled radio of similar songs.
  z.object({ type: z.literal('playRadio'), track: Track }),
  z.object({
    type: z.literal('enqueue'),
    tracks: z.array(Track).min(1).max(200),
    isNext: z.boolean(),
  }),
  z.object({ type: z.literal('remove'), index: z.number().int().min(0) }),
  z.object({ type: z.literal('move'), from: z.number().int().min(0), to: z.number().int().min(0) }),
  // Swaps the entry at `index` (a song for its music video) and keeps playing from the same point.
  z.object({ type: z.literal('replace'), index: z.number().int().min(0), track: Track }),
  z.object({ type: z.literal('shuffle') }),
  z.object({ type: z.literal('repeat') }),
]);

export type Command = z.infer<typeof Command>;

export const ClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), device: Device }),
  // From the active device whenever its playback changes, plus a periodic position beat.
  z.object({ type: z.literal('state'), state: PlaybackState }),
  // From any device: forwarded to the active one.
  z.object({ type: z.literal('command'), command: Command }),
  // Move playback to `deviceId` ("listen here" when it is the sender).
  z.object({ type: z.literal('transfer'), deviceId: z.string(), shouldPlay: z.boolean() }),
]);

export type ClientMessage = z.infer<typeof ClientMessage>;

export const DeviceStatus = Device.extend({ lastSeenAt: z.number() });

export type DeviceStatus = z.infer<typeof DeviceStatus>;

export const ServerMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sync'),
    devices: z.array(DeviceStatus),
    activeDeviceId: z.string().nullable(),
    state: PlaybackState.nullable(),
    serverTime: z.number(),
  }),
  z.object({ type: z.literal('command'), command: Command }),
  // Sent to the device that must start playing from `state`.
  z.object({ type: z.literal('takeover'), state: PlaybackState }),
  // Sent to the device that must stop because another one took over.
  z.object({ type: z.literal('release') }),
  // Sent to everyone when an admin publishes or ends an announcement.
  z.object({ type: z.literal('announcements') }),
]);

export type ServerMessage = z.infer<typeof ServerMessage>;

/** Where playback is now, extrapolating from the last report while it plays. */
export function currentPositionMs(state: PlaybackState, now: number) {
  return state.isPlaying ? state.positionMs + Math.max(0, now - state.updatedAt) : state.positionMs;
}
