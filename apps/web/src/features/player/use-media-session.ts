import { useEffect } from 'react';

import { imageUrl } from '../../lib/image.ts';
import { PlaybackStatus, currentTrack, usePlayerStore } from './player-store.ts';

/** Lock screen, notification and headset controls on Android. */
export function useMediaSession() {
  const track = usePlayerStore(currentTrack);
  const status = usePlayerStore((state) => state.status);
  const position = usePlayerStore((state) => state.position);
  const duration = usePlayerStore((state) => state.duration);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) {
      return;
    }

    const artwork = imageUrl(track.thumbnail);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artists.map((artist) => artist.name).join(', '),
      album: track.album?.name ?? '',
      artwork: artwork ? [{ src: artwork, sizes: '544x544' }] : [],
    });
  }, [track]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return;
    }

    const store = usePlayerStore.getState;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => store().togglePlay()],
      ['pause', () => store().togglePlay()],
      ['nexttrack', () => store().next()],
      ['previoustrack', () => store().previous()],
      ['seekto', (details) => store().seek(details.seekTime ?? 0)],
    ];

    for (const [action, handler] of handlers) {
      navigator.mediaSession.setActionHandler(action, handler);
    }

    return () => {
      for (const [action] of handlers) {
        navigator.mediaSession.setActionHandler(action, null);
      }
    };
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return;
    }

    navigator.mediaSession.playbackState = status === PlaybackStatus.Playing ? 'playing' : 'paused';

    if (duration > 0 && position <= duration) {
      navigator.mediaSession.setPositionState({ duration, position, playbackRate: 1 });
    }
  }, [status, position, duration]);
}
