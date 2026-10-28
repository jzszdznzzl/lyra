import { Maximize } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { Track } from '@lyra/shared';

import { PlaybackStatus, usePlayerStore } from './player-store.ts';

// Local audio reports precise times; a mirrored remote only every half second.
const LOCAL_DRIFT_SECONDS = 0.35;
const REMOTE_DRIFT_SECONDS = 1.2;

/**
 * The music video, muted and following the audio engine. Audio stays in Web Audio, so the
 * equalizer, crossfade and Connect keep working while the video plays.
 */
export function VideoView({ track, className = '' }: { track: Track; className?: string }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const height = usePlayerStore((state) => state.settings.videoHeight);
  const position = usePlayerStore((state) => state.position);
  const status = usePlayerStore((state) => state.status);
  const isRemote = usePlayerStore((state) => state.remote !== null);
  const isPlaying = status === PlaybackStatus.Playing;

  useEffect(() => {
    const element = video.current;
    const drift = isRemote ? REMOTE_DRIFT_SECONDS : LOCAL_DRIFT_SECONDS;

    if (element && element.readyState > 0 && Math.abs(element.currentTime - position) > drift) {
      element.currentTime = position;
    }
  }, [position, isRemote]);

  useEffect(() => {
    const element = video.current;

    if (!element) {
      return;
    }

    if (isPlaying) {
      element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [isPlaying, track.id]);

  return (
    <div className={`group relative overflow-hidden rounded-xl bg-black ${className}`}>
      <video
        ref={video}
        key={track.id}
        src={`/api/stream/${encodeURIComponent(track.id)}?type=video&height=${height}`}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(event) => {
          event.currentTarget.currentTime = usePlayerStore.getState().position;
        }}
        className="size-full object-contain"
      />
      <button
        type="button"
        aria-label={t('video.fullscreen')}
        onClick={() => void video.current?.requestFullscreen().catch(() => undefined)}
        className="absolute right-2 bottom-2 rounded-lg bg-black/50 p-1.5 text-white opacity-80 transition hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Maximize className="size-4" />
      </button>
    </div>
  );
}
