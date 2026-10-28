// Shared by the app and the service worker, so both agree on where offline data lives.

export const AUDIO_CACHE = 'lyra-audio-v1';
export const IMAGE_CACHE = 'lyra-images-v1';

/** Cache key of a downloaded song; never a real URL, so nothing fetches it by accident. */
export function offlineAudioKey(videoId: string) {
  return `/offline/audio/${encodeURIComponent(videoId)}`;
}
