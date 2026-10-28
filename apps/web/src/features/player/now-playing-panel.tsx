import { useTranslation } from 'react-i18next';

import { MediaKind } from '@lyra/shared';

import { useMediaQuery } from '../../lib/use-media-query.ts';
import { Cover } from '../../ui/cover.tsx';
import { LikeButton } from '../library/like-button.tsx';
import { TrackMenu } from '../library/track-menu.tsx';
import { ArtistLinks } from '../music/artist-links.tsx';
import { currentTrack, usePlayerStore } from './player-store.ts';
import { LyricsView } from './lyrics-view.tsx';
import { QueuePanel } from './queue-panel.tsx';
import { PanelView, useUiStore } from './ui-store.ts';
import { VideoToggle } from './video-toggle.tsx';
import { VideoView } from './video-view.tsx';

/** Right column on wide screens, as in the desktop mockup. */
export function NowPlayingPanel() {
  const { t } = useTranslation();
  const track = usePlayerStore(currentTrack);
  const isVideoMode = usePlayerStore((state) => state.isVideoMode);
  // Matches Tailwind's xl breakpoint; below it the panel would only waste a video download.
  const isWide = useMediaQuery('(min-width: 1280px)');
  const tab = useUiStore((state) => state.panelView);
  const setTab = useUiStore((state) => state.setPanelView);
  const TAB_LABELS: Record<PanelView, string> = {
    [PanelView.Cover]: t('player.nowPlaying'),
    [PanelView.Lyrics]: t('lyrics.title'),
    [PanelView.Queue]: t('player.queue'),
  };

  if (!isWide) {
    return null;
  }

  return (
    <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl xl:flex">
      <div className="flex gap-1.5">
        {Object.values(PanelView).map((option) => (
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
        tab === PanelView.Cover ? (
          <>
            <div className="relative">
              {isVideoMode && track.kind === MediaKind.Video ? (
                <VideoView track={track} className="aspect-video w-full" />
              ) : (
                <Cover
                  src={track.thumbnail}
                  alt={track.title}
                  className="aspect-square w-full shadow-2xl shadow-accent/30"
                />
              )}
              <div className="absolute top-3 left-3">
                <VideoToggle track={track} />
              </div>
            </div>
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
        ) : tab === PanelView.Lyrics ? (
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
