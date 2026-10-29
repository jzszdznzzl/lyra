import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Play } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';
import { Button } from '../../ui/button.tsx';
import { Cover } from '../../ui/cover.tsx';
import { Page } from '../../ui/page.tsx';
import { ErrorState, LoadingState } from '../music/query-state.tsx';
import { TrackList } from '../music/track-list.tsx';
import { usePlayerStore } from '../player/player-store.ts';
import { BarStrip } from './bar-strip.tsx';
import { peakIndex, recapQuery } from './recap.ts';

// Hour labels every six hours keep the strip readable on a phone.
const HOUR_LABEL_EVERY = 6;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-[19px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** "Your year in Lyra": totals, favourites and when the listening happened. */
export function RecapPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { year: requested } = useSearch({ from: '/app/recap' });
  const [currentYear] = useState(() => new Date().getFullYear());
  const year = requested ?? currentYear;
  const recap = useQuery(recapQuery(year));
  const playTracks = usePlayerStore((state) => state.playTracks);
  useDocumentTitle(t('recap.title', { year }));

  const number = new Intl.NumberFormat(i18n.language);
  const monthName = (index: number, style: 'short' | 'long' | 'narrow') =>
    new Intl.DateTimeFormat(i18n.language, { month: style, timeZone: 'UTC' }).format(
      Date.UTC(2000, index, 1),
    );
  const data = recap.data;
  const topArtist = data?.topArtists[0] ?? null;
  const peakHour = data ? peakIndex(data.hours) : null;
  const peakMonth = data ? peakIndex(data.months) : null;
  const tracks = data?.topTracks.map((item) => item.track) ?? [];
  const countingSince =
    data?.countingSince && new Date(data.countingSince).getFullYear() === year
      ? data.countingSince
      : null;

  return (
    <Page>
      <header className="-mx-4 mb-2 bg-gradient-to-b from-accent/25 to-transparent px-4 pt-10 pb-6 sm:-mx-7 sm:px-7">
        <p className="text-xs font-bold tracking-[0.12em] text-muted uppercase">
          {t('recap.kicker')}
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-6xl">
          {t('recap.title', { year })}
        </h1>
        {data && data.years.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.years.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === year}
                onClick={() => void navigate({ to: '/recap', search: { year: option } })}
                className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-muted aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </header>
      {recap.isPending ? <LoadingState /> : null}
      {recap.isError ? (
        <ErrorState error={recap.error} onRetry={() => void recap.refetch()} />
      ) : null}
      {data && data.plays === 0 ? (
        <p className="max-w-md text-sm text-muted">{t('recap.empty')}</p>
      ) : null}
      {data && data.plays > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={number.format(data.minutes)} label={t('recap.minutes')} />
            <Stat value={number.format(data.plays)} label={t('recap.plays')} />
            <Stat value={number.format(data.songs)} label={t('recap.songs')} />
            <Stat value={number.format(data.artists)} label={t('recap.artists')} />
          </div>
          {countingSince ? (
            <p className="mt-3 text-xs text-muted">
              {t('recap.countingSince', {
                date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
                  countingSince,
                ),
              })}
            </p>
          ) : null}

          {topArtist ? (
            <Section title={t('recap.topArtists')}>
              <ol className="flex flex-col gap-2">
                {data.topArtists.map((artist, index) => (
                  <li key={artist.name} className="flex items-center gap-3">
                    <span className="w-6 text-right text-lg font-extrabold text-muted tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{artist.name}</span>
                      <span className="mt-1 block h-1.5 rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${(artist.plays / topArtist.plays) * 100}%` }}
                        />
                      </span>
                    </span>
                    <span className="w-24 text-right text-xs text-muted tabular-nums">
                      {t('recap.timesPlayed', { count: artist.plays })}
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {tracks.length > 0 ? (
            <Section title={t('recap.topTracks')}>
              <div className="mb-3">
                <Button onClick={() => playTracks(tracks, 0)}>
                  <Play className="size-4 fill-current" />
                  {t('recap.playTop')}
                </Button>
              </div>
              <TrackList tracks={tracks} showIndex shouldPlayInOrder />
            </Section>
          ) : null}

          <Section title={t('recap.byMonth')}>
            <BarStrip
              values={data.months}
              labels={data.months.map((_, index) => monthName(index, 'narrow'))}
              highlight={peakMonth}
              describe={(index, value) =>
                `${monthName(index, 'long')}: ${t('recap.timesPlayed', { count: value })}`
              }
            />
            {peakMonth !== null ? (
              <p className="mt-2 text-sm text-muted">
                {t('recap.peakMonth', { month: monthName(peakMonth, 'long') })}
              </p>
            ) : null}
          </Section>

          <Section title={t('recap.byHour')}>
            <BarStrip
              values={data.hours}
              labels={data.hours.map((_, hour) =>
                hour % HOUR_LABEL_EVERY === 0 ? `${hour}h` : '',
              )}
              highlight={peakHour}
              describe={(hour, value) => `${hour}:00: ${t('recap.timesPlayed', { count: value })}`}
            />
            {peakHour !== null ? (
              <p className="mt-2 text-sm text-muted">
                {t('recap.peakHour', { hour: `${peakHour}:00` })}
              </p>
            ) : null}
          </Section>

          {data.firstTrack ? (
            <Section title={t('recap.firstTrack')}>
              <div className="flex items-center gap-3">
                <Cover src={data.firstTrack.thumbnail} alt="" className="size-14 rounded-lg" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{data.firstTrack.title}</span>
                  <span className="block truncate text-sm text-muted">
                    {data.firstTrack.artists.map((artist) => artist.name).join(', ')}
                  </span>
                </span>
              </div>
            </Section>
          ) : null}
        </>
      ) : null}
    </Page>
  );
}
