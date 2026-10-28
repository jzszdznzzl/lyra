import { AudioContainer } from '@lyra/shared';
import type { AudioQuality } from '@lyra/shared';

/**
 * MP4 (AAC) when this browser is not sure it plays WebM (Opus), as with Safari on iPhone.
 * Otherwise every song fails to load and the player skips through the whole queue.
 */
export function preferredAudioContainer(): AudioContainer | null {
  const probe = document.createElement('audio');

  return probe.canPlayType('audio/webm; codecs="opus"') === 'probably' ? null : AudioContainer.Mp4;
}

export function audioStreamUrl(videoId: string, quality: AudioQuality) {
  const params = new URLSearchParams({ quality });
  const container = preferredAudioContainer();

  if (container) {
    params.set('container', container);
  }

  return `/api/stream/${encodeURIComponent(videoId)}?${params.toString()}`;
}
