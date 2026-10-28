import { sql } from 'drizzle-orm';

import type { StatEvent, Track } from '@lyra/shared';

import { schema } from '../db/index.ts';
import { errorMessage, moduleLogger } from '../logger.ts';
import type { AppContext } from '../context.ts';

const HOUR_MS = 60 * 60 * 1000;

const log = moduleLogger('stats');

/** Statistics must never break what they measure: a failed write is logged and dropped. */
function quietly(label: string, write: () => void) {
  try {
    write();
  } catch (error) {
    log.warn(`${label}: ${errorMessage(error)}`);
  }
}

function hourOf(at: number) {
  return Math.floor(at / HOUR_MS);
}

export function recordActive(ctx: AppContext, userId: string) {
  quietly('active', () => {
    ctx.db
      .insert(schema.activeHours)
      .values({ hour: hourOf(ctx.now()), userId })
      .onConflictDoNothing()
      .run();
  });
}

export function countEvent(ctx: AppContext, name: StatEvent) {
  quietly(name, () => {
    ctx.db
      .insert(schema.eventHours)
      .values({ hour: hourOf(ctx.now()), name, count: 1 })
      .onConflictDoUpdate({
        target: [schema.eventHours.hour, schema.eventHours.name],
        set: { count: sql`${schema.eventHours.count} + 1` },
      })
      .run();
  });
}

/** A song heard past the listen threshold; `track` is null when the client did not send it. */
export function recordPlay(ctx: AppContext, userId: string, videoId: string, track: Track | null) {
  quietly('play', () => {
    ctx.db
      .insert(schema.plays)
      .values({
        userId,
        videoId,
        title: track?.title ?? null,
        artists: track ? track.artists.map((artist) => artist.name) : null,
        durationSeconds: track?.durationSeconds ?? null,
        playedAt: ctx.now(),
      })
      .run();
  });
}
