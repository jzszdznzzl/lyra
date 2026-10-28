import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { STATS_RANGES } from '@lyra/shared';
import type { AdminStats } from '@lyra/shared';

import { formatBytes } from '../../lib/format.ts';
import { adminStatsQuery } from './api.ts';
import { ColumnChart, RankedList, ShareBar } from './charts.tsx';

const DEFAULT_RANGE = 30;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl sm:p-6">
      <header>
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
    </div>
  );
}

function shortDay(day: string, language: string) {
  return new Intl.DateTimeFormat(language, { day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

function longDay(day: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

function StatsView({ stats }: { stats: AdminStats }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const number = (value: number) => value.toLocaleString(language);
  const hours = Math.round(stats.period.minutesPlayed / 60);
  const dailyPoints = (pick: (day: AdminStats['daily'][number]) => number) =>
    stats.daily.map((day) => ({
      key: day.day,
      label: shortDay(day.day, language),
      title: longDay(day.day, language),
      value: pick(day),
    }));
  const sum = (pick: (day: AdminStats['daily'][number]) => number) =>
    stats.daily.reduce((total, day) => total + pick(day), 0);
  const problems = sum((day) => day.streamErrors + day.streamGoogleRequired);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label={t('admin.stats.plays')} value={number(stats.period.plays)} />
        <Tile label={t('admin.stats.listeners')} value={number(stats.period.listeners)} />
        <Tile label={t('admin.stats.hours')} value={number(hours)} />
        <Tile label={t('admin.stats.active')} value={number(stats.period.activeUsers)} />
        <Tile label={t('admin.stats.signups')} value={number(stats.period.signups)} />
        <Tile label={t('admin.stats.online')} value={number(stats.totals.onlineNow)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t('admin.stats.playsPerDay')}>
          <ColumnChart
            label={t('admin.stats.playsPerDay')}
            language={language}
            points={dailyPoints((day) => day.plays)}
          />
        </Card>
        <Card title={t('admin.stats.activePerDay')}>
          <ColumnChart
            label={t('admin.stats.activePerDay')}
            language={language}
            points={dailyPoints((day) => day.activeUsers)}
          />
        </Card>
        <Card title={t('admin.stats.topTracks')}>
          <RankedList
            language={language}
            empty={t('admin.stats.noPlays')}
            rows={stats.topTracks.map((track) => ({
              key: track.videoId,
              label: track.title,
              detail: track.artists,
              value: track.plays,
            }))}
          />
        </Card>
        <Card title={t('admin.stats.topArtists')}>
          <RankedList
            language={language}
            empty={t('admin.stats.noPlays')}
            rows={stats.topArtists.map((artist) => ({
              key: artist.name,
              label: artist.name,
              value: artist.plays,
            }))}
          />
        </Card>
        <Card title={t('admin.stats.byHour')} hint={t('admin.stats.byHourHint')}>
          <ColumnChart
            label={t('admin.stats.byHour')}
            language={language}
            points={HOURS.map((hour) => ({
              key: String(hour),
              label: String(hour),
              title: `${String(hour).padStart(2, '0')}:00–${String(hour).padStart(2, '0')}:59`,
              value: stats.playsByHour[hour] ?? 0,
            }))}
          />
        </Card>
        <Card title={t('admin.stats.streams')} hint={t('admin.stats.streamsHint')}>
          <ShareBar
            label={t('admin.stats.streams')}
            language={language}
            slices={[
              {
                key: 'own',
                label: t('admin.stats.streamOwn'),
                value: sum((day) => day.streamOwn),
                color: 'var(--chart-1)',
              },
              {
                key: 'anonymous',
                label: t('admin.stats.streamAnonymous'),
                value: sum((day) => day.streamAnonymous),
                color: 'var(--chart-2)',
              },
              {
                key: 'fallback',
                label: t('admin.stats.streamFallback'),
                value: sum((day) => day.streamFallback),
                color: 'var(--chart-3)',
              },
            ]}
          />
          <p className="text-sm text-muted">
            {problems === 0
              ? t('admin.stats.noProblems')
              : t('admin.stats.problems', {
                  errors: number(sum((day) => day.streamErrors)),
                  google: number(sum((day) => day.streamGoogleRequired)),
                })}
          </p>
        </Card>
      </div>
      <Card title={t('admin.stats.server')}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {[
            [t('admin.stats.users'), stats.totals.users],
            [t('admin.stats.verified'), stats.totals.verified],
            [t('admin.stats.googleLinked'), stats.totals.googleLinked],
            [t('admin.stats.suspended'), stats.totals.suspended],
            [t('admin.stats.admins'), stats.totals.admins],
            [t('admin.stats.tokens'), stats.totals.apiTokens],
            [t('admin.stats.widgets'), stats.totals.publicWidgets],
            [t('admin.stats.playsAllTime'), stats.totals.playsAllTime],
            [t('admin.stats.widgetViews'), sum((day) => day.widgetViews)],
            [t('admin.stats.apiRequests'), sum((day) => day.apiRequests)],
            [t('admin.stats.images'), stats.storage.images],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-bold tabular-nums">{number(Number(value))}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs text-muted">{t('admin.stats.database')}</dt>
            <dd className="font-bold tabular-nums">{formatBytes(stats.storage.databaseBytes)}</dd>
          </div>
        </dl>
      </Card>
      <details className="rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl sm:p-6">
        <summary className="cursor-pointer text-sm font-bold">{t('admin.stats.table')}</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1.5 pr-4 font-semibold">{t('admin.stats.day')}</th>
                <th className="py-1.5 pr-4 font-semibold">{t('admin.stats.plays')}</th>
                <th className="py-1.5 pr-4 font-semibold">{t('admin.stats.listeners')}</th>
                <th className="py-1.5 pr-4 font-semibold">{t('admin.stats.active')}</th>
                <th className="py-1.5 pr-4 font-semibold">{t('admin.stats.signups')}</th>
                <th className="py-1.5 pr-4 font-semibold">{t('admin.stats.streamFallback')}</th>
                <th className="py-1.5 font-semibold">{t('admin.stats.errors')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...stats.daily].reverse().map((day) => (
                <tr key={day.day}>
                  <td className="py-1.5 pr-4">{longDay(day.day, language)}</td>
                  <td className="py-1.5 pr-4">{number(day.plays)}</td>
                  <td className="py-1.5 pr-4">{number(day.listeners)}</td>
                  <td className="py-1.5 pr-4">{number(day.activeUsers)}</td>
                  <td className="py-1.5 pr-4">{number(day.signups)}</td>
                  <td className="py-1.5 pr-4">{number(day.streamFallback)}</td>
                  <td className="py-1.5">{number(day.streamErrors + day.streamGoogleRequired)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function StatsTab() {
  const { t } = useTranslation();
  const [days, setDays] = useState(DEFAULT_RANGE);
  const stats = useQuery(adminStatsQuery(days));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATS_RANGES.map((range) => (
          <button
            key={range}
            type="button"
            aria-pressed={days === range}
            onClick={() => setDays(range)}
            className="rounded-full border border-line px-3.5 py-1.5 text-sm font-bold text-muted transition aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
          >
            {t('admin.stats.lastDays', { count: range })}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">{t('admin.stats.totalsOnly')}</span>
      </div>
      {stats.data ? <StatsView stats={stats.data} /> : null}
    </div>
  );
}
