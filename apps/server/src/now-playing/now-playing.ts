import { eq } from 'drizzle-orm';

import { Track } from '@lyra/shared';
import type { Device, NowPlaying, NowPlayingTrack, PlaybackState } from '@lyra/shared';

import { schema } from '../db/index.ts';
import { errorMessage, moduleLogger } from '../logger.ts';
import type { ConnectHub, RoomActivity } from '../connect/hub.ts';
import type { AppContext } from '../context.ts';

interface Saved {
  trackId: string;
  isPlaying: boolean;
}

export type NowPlayingListener = (nowPlaying: NowPlaying) => void;

// Position reports drift a little; a bigger jump is a seek, which listeners should hear about.
const SEEK_TOLERANCE_MS = 2000;
const log = moduleLogger('now-playing');

// Each open event stream holds a connection, so one account cannot hoard them.
export const MAX_LISTENERS_PER_USER = 10;

function hasMoved(before: NowPlaying, after: NowPlaying) {
  const expected = before.isPlaying
    ? before.progressMs + (after.updatedAt - before.updatedAt)
    : before.progressMs;

  return (
    before.track.id !== after.track.id ||
    before.isPlaying !== after.isPlaying ||
    before.device?.name !== after.device?.name ||
    Math.abs(after.progressMs - expected) > SEEK_TOLERANCE_MS
  );
}

/**
 * What each user is listening to, for personal tokens and the public widget. Live data comes
 * from the Connect room; the last song heard is also stored, so it survives restarts and quiet
 * hours.
 */
export class NowPlayingService {
  #ctx: AppContext;
  #hub: ConnectHub;
  #origin: string;
  #listeners = new Map<string, Set<NowPlayingListener>>();
  #lastSent = new Map<string, NowPlaying>();
  #lastSaved = new Map<string, Saved>();

  constructor(ctx: AppContext, hub: ConnectHub) {
    this.#ctx = ctx;
    this.#hub = hub;
    this.#origin = new URL(ctx.env.PUBLIC_URL).origin;
    hub.onActivity((userId, activity) => this.#changed(userId, activity));
  }

  #toTrack(track: Track): NowPlayingTrack {
    const thumbnail = track.thumbnail ?? '';
    // The web app keeps covers as lyra image paths; elsewhere they need the full address.
    let coverUrl: string | null = null;

    if (thumbnail.startsWith('/')) {
      coverUrl = `${this.#origin}${thumbnail}`;
    } else if (thumbnail.startsWith('https://')) {
      coverUrl = thumbnail;
    }

    const id = encodeURIComponent(track.id);

    return {
      id: track.id,
      title: track.title,
      artists: track.artists,
      album: track.album,
      durationMs: track.durationSeconds === null ? null : track.durationSeconds * 1000,
      coverUrl,
      url: `${this.#origin}/track/${id}`,
      youtubeMusicUrl: `https://music.youtube.com/watch?v=${id}`,
    };
  }

  #fromState(state: PlaybackState, device: Device | null): NowPlaying | null {
    const track = state.queue[state.index];

    if (!track) {
      return null;
    }

    return {
      isPlaying: state.isPlaying,
      track: this.#toTrack(track),
      progressMs: Math.round(state.positionMs),
      updatedAt: state.updatedAt,
      device: device ? { name: device.name, kind: device.kind } : null,
    };
  }

  async #save(userId: string, state: PlaybackState) {
    const track = state.queue[state.index];
    const saved = this.#lastSaved.get(userId);

    // A new song, or playback starting or stopping; position updates are not worth a write.
    if (!track || (saved?.trackId === track.id && saved.isPlaying === state.isPlaying)) {
      return;
    }

    this.#lastSaved.set(userId, { trackId: track.id, isPlaying: state.isPlaying });
    const row = { userId, track, playedAt: state.updatedAt };
    await this.#ctx.db
      .insert(schema.lastPlayed)
      .values(row)
      .onConflictDoUpdate({ target: schema.lastPlayed.userId, set: row });
  }

  #changed(userId: string, activity: RoomActivity | null) {
    if (!activity) {
      return;
    }

    this.#save(userId, activity.state).catch((error: unknown) => {
      log.warn({ err: error }, `could not save the last song: ${errorMessage(error)}`);
    });

    const nowPlaying = this.#fromState(activity.state, activity.device);
    const previous = this.#lastSent.get(userId);

    if (!nowPlaying || (previous && !hasMoved(previous, nowPlaying))) {
      return;
    }

    this.#lastSent.set(userId, nowPlaying);

    for (const listener of this.#listeners.get(userId) ?? []) {
      listener(nowPlaying);
    }
  }

  async #lastPlayed(userId: string): Promise<NowPlaying | null> {
    const [row] = await this.#ctx.db
      .select()
      .from(schema.lastPlayed)
      .where(eq(schema.lastPlayed.userId, userId));
    const track = Track.safeParse(row?.track);

    if (!row || !track.success) {
      return null;
    }

    return {
      isPlaying: false,
      track: this.#toTrack(track.data),
      progressMs: 0,
      updatedAt: row.playedAt,
      device: null,
    };
  }

  /** The song playing now (or paused), else the last one heard; null if there never was one. */
  async current(userId: string): Promise<NowPlaying | null> {
    const activity = this.#hub.activity(userId);
    const live = activity ? this.#fromState(activity.state, activity.device) : null;

    return live ?? this.#lastPlayed(userId);
  }

  /** Calls `listener` on every change; returns the unsubscribe function, or null when full. */
  subscribe(userId: string, listener: NowPlayingListener): (() => void) | null {
    const listeners = this.#listeners.get(userId) ?? new Set();

    if (listeners.size >= MAX_LISTENERS_PER_USER) {
      return null;
    }

    listeners.add(listener);
    this.#listeners.set(userId, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this.#listeners.delete(userId);
      }
    };
  }
}
