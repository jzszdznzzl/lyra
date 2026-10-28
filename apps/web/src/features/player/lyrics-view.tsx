import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { LyricsResponse, activeLineIndex } from '@lyra/shared';
import type { Track } from '@lyra/shared';

import { isMotionReduced } from '../../app/motion.ts';
import { ApiError, api, unwrap } from '../../lib/api.ts';
import { offlineLyrics } from '../offline/downloads.ts';
import { LoadingState } from '../music/query-state.tsx';
import { usePlayerStore } from './player-store.ts';

const HOUR_MS = 60 * 60 * 1000;

function lyricsQuery(track: Track) {
  const params = new URLSearchParams({
    title: track.title,
    artist: track.artists.map((artist) => artist.name).join(', '),
    album: track.album?.name ?? '',
    duration: String(track.durationSeconds ?? 0),
  });

  return {
    queryKey: ['lyrics', track.id],
    queryFn: async () => {
      const result = await api(
        'GET',
        `/lyrics/${encodeURIComponent(track.id)}?${params.toString()}`,
        LyricsResponse,
      );

      // Downloaded songs keep their lyrics for offline listening.
      if (result.error === ApiError.Network) {
        return (await offlineLyrics(track.id)) ?? unwrap(result);
      }

      return unwrap(result);
    },
    staleTime: HOUR_MS,
  };
}

export function LyricsView({ track, size = 'md' }: { track: Track; size?: 'md' | 'lg' }) {
  const { t } = useTranslation();
  const query = useQuery(lyricsQuery(track));
  const positionMs = usePlayerStore((state) => state.position * 1000);
  const seek = usePlayerStore((state) => state.seek);
  const isSyncEnabled = usePlayerStore((state) => state.settings.isLyricsSyncEnabled);
  const updateSettings = usePlayerStore((state) => state.updateSettings);
  const container = useRef<HTMLDivElement>(null);
  const lyrics = query.data?.lyrics ?? null;
  const isSynced = (lyrics?.isSynced ?? false) && isSyncEnabled;
  const active = lyrics && isSynced ? activeLineIndex(lyrics.lines, positionMs) : -1;

  useEffect(() => {
    // Keeps the sung line near the middle without dragging the whole page along.
    const line = container.current?.querySelector<HTMLElement>(`[data-line="${active}"]`);
    const box = container.current;

    if (line && box) {
      box.scrollTo({
        top: line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2,
        behavior: isMotionReduced() ? 'auto' : 'smooth',
      });
    }
  }, [active]);

  if (query.isPending) {
    return <LoadingState />;
  }

  if (!lyrics) {
    return <p className="py-6 text-sm text-muted">{t('lyrics.none')}</p>;
  }

  return (
    <div
      ref={container}
      className="relative min-h-0 flex-1 overflow-y-auto py-2 [scrollbar-width:none]"
    >
      {lyrics.isSynced ? null : <p className="mb-3 text-xs text-muted">{t('lyrics.unsynced')}</p>}
      {lyrics.lines.map((line, index) => {
        const timeMs = line.timeMs;

        return (
          <p
            key={`${index}-${line.timeMs ?? 'x'}`}
            data-line={index}
            onClick={timeMs === null || !isSynced ? undefined : () => seek(timeMs / 1000)}
            className={`leading-snug font-extrabold tracking-tight transition-colors ${size === 'lg' ? 'py-3 text-3xl sm:text-5xl' : 'py-1.5 text-xl'} ${
              !isSynced
                ? 'text-text/80'
                : index === active
                  ? 'text-text'
                  : index < active
                    ? 'text-text/35'
                    : 'text-text/45'
            } ${timeMs === null || !isSynced ? '' : 'cursor-pointer hover:text-text/80'}`}
          >
            {line.text || '♪'}
          </p>
        );
      })}
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        {t('lyrics.source', { source: lyrics.source === 'lrclib' ? 'LRCLIB' : 'YouTube Music' })}
        {lyrics.isSynced ? (
          <button
            type="button"
            onClick={() => updateSettings({ isLyricsSyncEnabled: !isSyncEnabled })}
            className="font-bold underline-offset-2 hover:text-text hover:underline"
          >
            {t(isSyncEnabled ? 'lyrics.turnSyncOff' : 'lyrics.turnSyncOn')}
          </button>
        ) : null}
      </p>
    </div>
  );
}
