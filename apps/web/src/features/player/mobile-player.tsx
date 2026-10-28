import { ChevronDown, ListMusic, Pause, Play, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { imageUrl } from '../../lib/image.ts';
import { toCss } from '../../lib/palette.ts';
import { useAccent } from '../../lib/use-accent.ts';
import { Cover } from '../../ui/cover.tsx';
import { ArtistLinks } from '../music/artist-links.tsx';
import { AudioSettingsDialog } from './audio-settings-dialog.tsx';
import { PlaybackStatus, currentTrack, usePlayerStore } from './player-store.ts';
import { ProgressBar } from './progress-bar.tsx';
import { QueuePanel } from './queue-panel.tsx';
import { TransportControls } from './transport-controls.tsx';

/** Mini player above the tab bar; tapping it opens the full-screen player from the mockup. */
export function MobilePlayer() {
  const { t } = useTranslation();
  const track = usePlayerStore(currentTrack);
  const status = usePlayerStore((state) => state.status);
  const position = usePlayerStore((state) => state.position);
  const duration = usePlayerStore((state) => state.duration);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const accent = useAccent(imageUrl(track?.thumbnail ?? null));
  const [isOpen, setIsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!track) {
    return null;
  }

  const isPlaying = status === PlaybackStatus.Playing;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-panel backdrop-blur-2xl md:hidden">
        <div className="flex items-center gap-3 p-2">
          <button
            type="button"
            aria-label={t('player.openNowPlaying')}
            onClick={() => setIsOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <Cover src={track.thumbnail} alt="" className="size-11 shrink-0 rounded-lg" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{track.title}</span>
              <span className="block truncate text-xs text-muted">
                {track.artists.map((artist) => artist.name).join(', ')}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label={isPlaying ? t('player.pause') : t('player.play')}
            onClick={togglePlay}
            className="grid size-10 place-items-center"
          >
            {isPlaying ? (
              <Pause className="size-6 fill-current" />
            ) : (
              <Play className="size-6 fill-current" />
            )}
          </button>
        </div>
        <div className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-text/10">
          <div
            className="h-full rounded-full bg-text"
            style={{ width: `${duration > 0 ? (position / duration) * 100 : 0}%` }}
          />
        </div>
      </div>
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] md:hidden"
          style={
            accent
              ? {
                  backgroundImage: `radial-gradient(500px 420px at 50% 20%, color-mix(in srgb, ${toCss(accent)} 75%, transparent), transparent 70%)`,
                }
              : undefined
          }
        >
          <header className="flex items-center justify-between text-muted">
            <button
              type="button"
              aria-label={t('player.close')}
              onClick={() => setIsOpen(false)}
              className="p-1"
            >
              <ChevronDown className="size-6" />
            </button>
            <span className="text-xs font-bold tracking-widest uppercase">
              {t('player.playingFrom')}
            </span>
            <button
              type="button"
              aria-label={t('player.settings.title')}
              onClick={() => setIsSettingsOpen(true)}
              className="p-1"
            >
              <SlidersHorizontal className="size-5" />
            </button>
          </header>
          {isQueueOpen ? (
            <div className="mt-6 flex-1">
              <QueuePanel />
            </div>
          ) : (
            <Cover
              src={track.thumbnail}
              alt={track.title}
              className="mx-auto mt-8 mb-8 aspect-square w-full max-w-sm shadow-2xl shadow-accent/40"
            />
          )}
          <div className="mt-auto">
            <h2 className="truncate text-2xl font-extrabold tracking-tight">{track.title}</h2>
            <p className="truncate text-[15px] text-muted">
              <ArtistLinks artists={track.artists} />
            </p>
            <div className="mt-6">
              <ProgressBar />
            </div>
            <div className="mt-4">
              <TransportControls size="lg" />
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                aria-label={t('player.queue')}
                aria-pressed={isQueueOpen}
                onClick={() => setIsQueueOpen(!isQueueOpen)}
                className="p-1 text-muted aria-pressed:text-accent"
              >
                <ListMusic className="size-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isSettingsOpen ? <AudioSettingsDialog onClose={() => setIsSettingsOpen(false)} /> : null}
    </>
  );
}
