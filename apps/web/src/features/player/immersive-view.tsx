import { Minimize } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { imageUrl } from '../../lib/image.ts';
import { useBackToClose } from '../../lib/use-back-to-close.ts';
import { Cover } from '../../ui/cover.tsx';
import { ArtistLinks } from '../music/artist-links.tsx';
import { LyricsView } from './lyrics-view.tsx';
import { PlaybackStatus, currentTrack, usePlayerStore } from './player-store.ts';
import { ProgressBar } from './progress-bar.tsx';
import { TransportControls } from './transport-controls.tsx';
import { ImmersiveMode, useUiStore } from './ui-store.ts';
import { VideoView } from './video-view.tsx';

const IDLE_MS = 3000;

/**
 * Lyra's own full screen (F key or the expand buttons). The browser's native video full screen
 * is avoided: its controls would only pause the muted picture, not the music.
 */
export function ImmersiveView() {
  const { t } = useTranslation();
  const mode = useUiStore((state) => state.immersive);
  const close = useUiStore((state) => state.closeImmersive);
  const track = usePlayerStore(currentTrack);
  const isPlaying = usePlayerStore((state) => state.status === PlaybackStatus.Playing);
  const root = useRef<HTMLDivElement>(null);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpen = mode !== null;

  useBackToClose(isOpen, close);

  const wake = useCallback(() => {
    setIsIdle(false);

    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
    }

    idleTimer.current = setTimeout(() => setIsIdle(true), IDLE_MS);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    root.current?.requestFullscreen().catch(() => {
      // Some browsers refuse; the overlay still covers the window.
    });

    if (mode === ImmersiveMode.Video) {
      // Phones turn sideways for video; desktops ignore this.
      Reflect.get(screen.orientation, 'lock')
        ?.call(screen.orientation, 'landscape')
        ?.catch?.(() => undefined);
    }

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        close();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKey);

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }

      screen.orientation.unlock?.();
    };
  }, [isOpen, mode, close]);

  if (!mode || !track) {
    return null;
  }

  // Controls fade out while video plays untouched, like any video player.
  const isHidden = mode === ImmersiveMode.Video && isPlaying && isIdle;
  const background = imageUrl(track.thumbnail);

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={t('video.fullscreen')}
      data-theme="dark"
      onPointerMove={wake}
      onPointerDown={wake}
      className={`fixed inset-0 z-[70] flex animate-fade-in flex-col bg-black text-text ${isHidden ? 'cursor-none' : ''}`}
    >
      {mode !== ImmersiveMode.Video && background ? (
        <div
          aria-hidden
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-3xl"
          style={{ backgroundImage: `url(${background})` }}
        />
      ) : null}
      <button
        type="button"
        aria-label={t('video.exitFullscreen')}
        onClick={close}
        className={`absolute top-4 right-4 z-10 rounded-full bg-black/40 p-2.5 text-white backdrop-blur transition-opacity ${isHidden ? 'opacity-0' : ''}`}
      >
        <Minimize className="size-5" />
      </button>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {mode === ImmersiveMode.Video ? (
          <VideoView track={track} isImmersive className="size-full rounded-none" />
        ) : mode === ImmersiveMode.Lyrics ? (
          <div className="flex h-full w-full max-w-4xl flex-col px-8 pt-16">
            <LyricsView track={track} size="lg" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 px-8 text-center">
            <Cover
              src={track.thumbnail}
              alt={track.title}
              className="aspect-square w-[min(60vh,80vw)] shadow-2xl"
            />
            <div>
              <p className="text-3xl font-extrabold tracking-tight sm:text-5xl">{track.title}</p>
              <p className="mt-2 text-lg text-muted">
                <ArtistLinks artists={track.artists} />
              </p>
            </div>
          </div>
        )}
      </div>
      <div
        className={`relative z-10 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-6 pt-10 pb-[max(env(safe-area-inset-bottom),1.5rem)] transition-opacity ${isHidden ? 'pointer-events-none opacity-0' : ''}`}
      >
        {mode === ImmersiveMode.Player ? null : (
          <p className="max-w-full truncate text-sm font-bold">
            {track.title} ·{' '}
            <span className="text-muted">
              {track.artists.map((artist) => artist.name).join(', ')}
            </span>
          </p>
        )}
        <div className="w-full max-w-2xl">
          <ProgressBar />
        </div>
        <TransportControls />
      </div>
    </div>,
    document.body,
  );
}
