import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Cover } from '../../ui/cover.tsx';
import { LikeButton } from '../library/like-button.tsx';
import { TrackMenu } from '../library/track-menu.tsx';
import { ArtistLinks } from '../music/artist-links.tsx';
import { currentTrack, usePlayerStore } from './player-store.ts';
import { LyricsView } from './lyrics-view.tsx';
import { QueuePanel } from './queue-panel.tsx';

const Tab = Object.freeze({ NowPlaying: 'now', Lyrics: 'lyrics', Queue: 'queue' } as const);

type Tab = (typeof Tab)[keyof typeof Tab];

/** Right column on wide screens, as in the desktop mockup. */
export function NowPlayingPanel() {
  const { t } = useTranslation();
  const track = usePlayerStore(currentTrack);
  const [tab, setTab] = useState<Tab>(Tab.NowPlaying);
  const TAB_LABELS: Record<Tab, string> = {
    [Tab.NowPlaying]: t('player.nowPlaying'),
    [Tab.Lyrics]: t('lyrics.title'),
    [Tab.Queue]: t('player.queue'),
  };

  return (
    <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl xl:flex">
      <div className="flex gap-1.5">
        {Object.values(Tab).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={tab === option}
            onClick={() => setTab(option)}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted aria-pressed:bg-text aria-pressed:text-bg"
          >
            {TAB_LABELS[option]}
          </button>
        ))}
      </div>
      {track ? (
        tab === Tab.NowPlaying ? (
          <>
            <Cover
              src={track.thumbnail}
              alt={track.title}
              className="aspect-square w-full shadow-2xl shadow-accent/30"
            />
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-extrabold tracking-tight">{track.title}</p>
                <p className="text-[13.5px] text-muted">
                  <ArtistLinks artists={track.artists} />
                  {track.album ? ` · ${track.album.name}` : ''}
                </p>
              </div>
              <LikeButton track={track} />
              <TrackMenu track={track} />
            </div>
            <QueuePanel />
          </>
        ) : tab === Tab.Lyrics ? (
          <LyricsView track={track} />
        ) : (
          <QueuePanel />
        )
      ) : (
        <p className="text-sm text-muted">{t('player.nothingPlaying')}</p>
      )}
    </aside>
  );
}
