import { z } from 'zod';

import { AudioContainer, MusicError } from '@lyra/shared';
import type { AudioQuality } from '@lyra/shared';

const StreamErrorBody = z.object({ error: z.enum(MusicError) });

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

/**
 * Why a stream failed, asked again with a one-byte request: the audio element only reports that
 * it failed, not the server's reason. Null when the server gives none or the stream now works.
 */
export async function streamFailure(url: string): Promise<MusicError | null> {
  try {
    const response = await fetch(url, {
      headers: { range: 'bytes=0-0' },
      credentials: 'same-origin',
    });

    if (response.ok) {
      await response.body?.cancel();

      return null;
    }

    const parsed = StreamErrorBody.safeParse(await response.json().catch(() => null));

    return parsed.success ? parsed.data.error : null;
  } catch {
    return null;
  }
}
