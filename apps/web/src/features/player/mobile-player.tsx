import {
  ChevronDown,
  ListMusic,
  Maximize,
  MicVocal,
  Pause,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MediaKind } from '@lyra/shared';

import { imageUrl } from '../../lib/image.ts';
import { useBackToClose } from '../../lib/use-back-to-close.ts';
import { toCss } from '../../lib/palette.ts';
import { useAccent } from '../../lib/use-accent.ts';
import { Cover } from '../../ui/cover.tsx';
import { DeviceButton } from '../connect/device-picker.tsx';
import { activeDevice, useConnectStore } from '../connect/connect-store.ts';
import { LikeButton } from '../library/like-button.tsx';
import { TrackMenu } from '../library/track-menu.tsx';
import { ArtistLinks } from '../music/artist-links.tsx';
import { AudioSettingsDialog } from './audio-settings-dialog.tsx';
import { PlaybackStatus, currentTrack, usePlayerStore } from './player-store.ts';
import { ProgressBar } from './progress-bar.tsx';
import { LyricsView } from './lyrics-view.tsx';
import { QueuePanel } from './queue-panel.tsx';
import { TransportControls } from './transport-controls.tsx';
import { PanelView, useUiStore } from './ui-store.ts';
import { VideoToggle } from './video-toggle.tsx';
import { VideoView } from './video-view.tsx';

/** Mini player above the tab bar; tapping it opens the full-screen player from the mockup. */
export function MobilePlayer() {
  const { t } = useTranslation();
  const track = usePlayerStore(currentTrack);
  const isVideoMode = usePlayerStore((state) => state.isVideoMode);
  const status = usePlayerStore((state) => state.status);
  const position = usePlayerStore((state) => state.position);
  const duration = usePlayerStore((state) => state.duration);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const accent = useAccent(imageUrl(track?.thumbnail ?? null));
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Open only on the page it was opened from: following a link (artist, album) reveals that page.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const isOpen = openedOn === pathname;

  useBackToClose(isOpen, () => setOpenedOn(null));
  const panel = useUiStore((state) => state.panelView);
  const setPanel = useUiStore((state) => state.setPanelView);
  const openImmersive = useUiStore((state) => state.openImmersive);
  const active = useConnectStore(activeDevice);
  const selfId = useConnectStore((state) => state.selfId);
  const playingElsewhere = active && active.id !== selfId ? active.name : null;
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
            onClick={() => setOpenedOn(pathname)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <Cover src={track.thumbnail} alt="" className="size-11 shrink-0 rounded-lg" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{track.title}</span>
              <span
                className={`block truncate text-xs ${playingElsewhere ? 'text-success' : 'text-muted'}`}
              >
                {playingElsewhere
                  ? t('connect.playingOn', { name: playingElsewhere })
                  : track.artists.map((artist) => artist.name).join(', ')}
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
              onClick={() => setOpenedOn(null)}
              className="p-1"
            >
              <ChevronDown className="size-6" />
            </button>
            <span className="text-xs font-bold tracking-widest uppercase">
              {t('player.playingFrom')}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t('video.fullscreen')}
                onClick={openImmersive}
                className="p-1"
              >
                <Maximize className="size-5" />
              </button>
              <button
                type="button"
                aria-label={t('player.settings.title')}
                onClick={() => setIsSettingsOpen(true)}
                className="p-1"
              >
                <SlidersHorizontal className="size-5" />
              </button>
            </span>
          </header>
          {panel === PanelView.Queue ? (
            <div className="mt-6 flex-1">
              <QueuePanel />
            </div>
          ) : panel === PanelView.Lyrics ? (
            <div className="mt-6 flex min-h-0 flex-1 flex-col">
              <LyricsView track={track} />
            </div>
          ) : (
            // Fills the space between header and controls and centers the cover or video in it.
            <div className="flex min-h-0 flex-1 items-center justify-center py-6">
              <div className="relative w-full max-w-sm">
                {isVideoMode && track.kind === MediaKind.Video ? (
                  <VideoView track={track} className="aspect-video w-full" />
                ) : (
                  <Cover
                    src={track.thumbnail}
                    alt={track.title}
                    className="aspect-square w-full shadow-2xl shadow-accent/40"
                  />
                )}
                <div className="absolute top-3 left-3">
                  <VideoToggle track={track} />
                </div>
              </div>
            </div>
          )}
          <div className="mt-auto">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl font-extrabold tracking-tight">{track.title}</h2>
                <p className="truncate text-[15px] text-muted">
                  <ArtistLinks artists={track.artists} />
                </p>
              </div>
              <LikeButton track={track} size="lg" />
              <TrackMenu track={track} />
            </div>
            <div className="mt-6">
              <ProgressBar />
            </div>
            <div className="mt-4">
              <TransportControls size="lg" />
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <DeviceButton isLabelled />
              <span className="flex gap-3">
                <button
                  type="button"
                  aria-label={t('lyrics.title')}
                  aria-pressed={panel === PanelView.Lyrics}
                  onClick={() =>
                    setPanel(panel === PanelView.Lyrics ? PanelView.Cover : PanelView.Lyrics)
                  }
                  className="p-1 text-muted aria-pressed:text-accent"
                >
                  <MicVocal className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label={t('player.queue')}
                  aria-pressed={panel === PanelView.Queue}
                  onClick={() =>
                    setPanel(panel === PanelView.Queue ? PanelView.Cover : PanelView.Queue)
                  }
                  className="p-1 text-muted aria-pressed:text-accent"
                >
                  <ListMusic className="size-5" />
                </button>
              </span>
            </div>
          </div>
        </div>
      ) : null}
      {isSettingsOpen ? <AudioSettingsDialog onClose={() => setIsSettingsOpen(false)} /> : null}
    </>
  );
}
