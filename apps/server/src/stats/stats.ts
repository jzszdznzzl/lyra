import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { count, gte } from 'drizzle-orm';
import { z } from 'zod';

import { StatEvent } from '@lyra/shared';
import type { AdminStats, StatsDay, StatsQuery } from '@lyra/shared';

import { isAdmin } from '../admin/admins.ts';
import { schema } from '../db/index.ts';
import type { AppContext } from '../context.ts';

type DayCounts = Omit<StatsDay, 'day'>;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const HOURS_PER_DAY = 24;
const TOP_LIMIT = 10;
const DATABASE_FILES = ['lyra.db', 'lyra.db-wal'];
const StoredArtists = z.array(z.string());

const EVENT_FIELDS = {
  [StatEvent.StreamOwn]: 'streamOwn',
  [StatEvent.StreamAnonymous]: 'streamAnonymous',
  [StatEvent.StreamFallback]: 'streamFallback',
  [StatEvent.StreamGoogleRequired]: 'streamGoogleRequired',
  [StatEvent.StreamError]: 'streamErrors',
  [StatEvent.WidgetView]: 'widgetViews',
  [StatEvent.ApiRequest]: 'apiRequests',
} as const satisfies Record<StatEvent, keyof DayCounts>;

function emptyDay(): DayCounts {
  return {
    signups: 0,
    activeUsers: 0,
    plays: 0,
    listeners: 0,
    streamOwn: 0,
    streamAnonymous: 0,
    streamFallback: 0,
    streamGoogleRequired: 0,
    streamErrors: 0,
    widgetViews: 0,
    apiRequests: 0,
  };
}

/** The ten keys with the most hits, most first; ties keep the order they were first seen. */
function top(counts: Map<string, number>) {
  return [...counts].sort(([, a], [, b]) => b - a).slice(0, TOP_LIMIT);
}

async function fileSize(path: string) {
  return (await stat(path).catch(() => null))?.size ?? 0;
}

/**
 * Totals and daily series for the admin panel, with days cut at the admin's own midnight.
 * Rows of the period are grouped here rather than in SQL: a personal server has few of them,
 * and it keeps time zones simple.
 */
export async function adminStats(
  ctx: AppContext,
  { days, offset }: StatsQuery,
  onlineNow: number,
): Promise<AdminStats> {
  const offsetMs = offset * MINUTE_MS;
  const today = Math.floor((ctx.now() + offsetMs) / DAY_MS);
  const firstDay = today - days + 1;
  const from = firstDay * DAY_MS - offsetMs;
  const dayIndex = (at: number) => Math.floor((at + offsetMs) / DAY_MS) - firstDay;
  const series = Array.from({ length: days }, emptyDay);
  const activeByDay = Array.from({ length: days }, () => new Set<string>());
  const listenersByDay = Array.from({ length: days }, () => new Set<string>());
  const playsByHour = Array.from({ length: HOURS_PER_DAY }, () => 0);
  const trackPlays = new Map<string, number>();
  const trackInfo = new Map<string, { title: string; artists: string }>();
  const artistPlays = new Map<string, number>();
  const listeners = new Set<string>();
  const activeUsers = new Set<string>();
  let minutesPlayed = 0;

  const users = await ctx.db.select().from(schema.users);
  const [googleLinked] = await ctx.db.select({ total: count() }).from(schema.googleAccounts);
  const [apiTokens] = await ctx.db.select({ total: count() }).from(schema.apiTokens);
  const [playsAllTime] = await ctx.db.select({ total: count() }).from(schema.plays);
  const [images] = await ctx.db.select({ total: count() }).from(schema.images);
  const plays = await ctx.db.select().from(schema.plays).where(gte(schema.plays.playedAt, from));
  const active = await ctx.db
    .select()
    .from(schema.activeHours)
    .where(gte(schema.activeHours.hour, Math.floor(from / HOUR_MS)));
  const events = await ctx.db
    .select()
    .from(schema.eventHours)
    .where(gte(schema.eventHours.hour, Math.floor(from / HOUR_MS)));

  for (const user of users) {
    const day = series[dayIndex(user.createdAt)];

    if (day && user.createdAt >= from) {
      day.signups += 1;
    }
  }

  for (const row of active) {
    const index = dayIndex(row.hour * HOUR_MS);
    activeByDay[index]?.add(row.userId);
    activeUsers.add(row.userId);
  }

  for (const row of events) {
    const day = series[dayIndex(row.hour * HOUR_MS)];
    const field = Object.entries(EVENT_FIELDS).find(([name]) => name === row.name)?.[1];

    if (day && field) {
      day[field] += row.count;
    }
  }

  for (const play of plays) {
    const index = dayIndex(play.playedAt);
    const day = series[index];

    if (!day) {
      continue;
    }

    day.plays += 1;
    const hour = Math.floor(((play.playedAt + offsetMs) % DAY_MS) / HOUR_MS);
    playsByHour[hour] = (playsByHour[hour] ?? 0) + 1;
    minutesPlayed += (play.durationSeconds ?? 0) / 60;

    if (play.userId) {
      listenersByDay[index]?.add(play.userId);
      listeners.add(play.userId);
    }

    const artists = StoredArtists.safeParse(play.artists);
    const names = artists.success ? artists.data : [];
    trackPlays.set(play.videoId, (trackPlays.get(play.videoId) ?? 0) + 1);

    if (play.title) {
      trackInfo.set(play.videoId, { title: play.title, artists: names.join(', ') });
    }

    for (const name of names) {
      artistPlays.set(name, (artistPlays.get(name) ?? 0) + 1);
    }
  }

  series.forEach((day, index) => {
    day.activeUsers = activeByDay[index]?.size ?? 0;
    day.listeners = listenersByDay[index]?.size ?? 0;
  });

  const databaseBytes = (
    await Promise.all(DATABASE_FILES.map((name) => fileSize(join(ctx.dataDir, name))))
  ).reduce((sum, size) => sum + size, 0);

  return {
    days,
    totals: {
      users: users.length,
      verified: users.filter((user) => user.emailVerifiedAt !== null).length,
      suspended: users.filter((user) => user.suspendedAt !== null).length,
      googleLinked: googleLinked?.total ?? 0,
      admins: users.filter((user) => isAdmin(ctx, user)).length,
      apiTokens: apiTokens?.total ?? 0,
      publicWidgets: users.filter((user) => user.isNowPlayingPublic && user.suspendedAt === null)
        .length,
      onlineNow,
      playsAllTime: playsAllTime?.total ?? 0,
    },
    period: {
      plays: plays.length,
      listeners: listeners.size,
      activeUsers: activeUsers.size,
      signups: series.reduce((sum, day) => sum + day.signups, 0),
      minutesPlayed: Math.round(minutesPlayed),
    },
    daily: series.map((counts, index) => ({
      day: new Date((firstDay + index) * DAY_MS).toISOString().slice(0, 10),
      ...counts,
    })),
    playsByHour,
    topTracks: top(trackPlays).map(([videoId, total]) => ({
      videoId,
      title: trackInfo.get(videoId)?.title ?? videoId,
      artists: trackInfo.get(videoId)?.artists ?? '',
      plays: total,
    })),
    topArtists: top(artistPlays).map(([name, total]) => ({ name, plays: total })),
    storage: { databaseBytes, images: images?.total ?? 0 },
  };
}
