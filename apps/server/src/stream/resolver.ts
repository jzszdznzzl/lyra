import { MusicError, err, ok } from '@lyra/shared';
import type { AudioQuality, Result } from '@lyra/shared';
import type { Innertube } from 'youtubei.js';

import { pickAudioFormat } from './formats.ts';

export interface ResolvedStream {
  url: string;
  mimeType: string;
  itag: number;
  bitrate: number;
  contentLength: number;
  loudnessDb: number | null;
  expiresAt: number;
}

// Leave a margin so a song that starts near expiry still finishes.
const EXPIRY_MARGIN_MS = 10 * 60 * 1000;
const DEFAULT_LIFETIME_MS = 60 * 60 * 1000;
// Without a PO token, googlevideo cuts web-client streams after the first MiB. The visionOS
// client is not held to that (same choice as yt-dlp); YT Music's own client is the fallback.
const STREAM_CLIENTS = ['VISIONOS', 'YTMUSIC'] as const;

async function fetchPlayableInfo(yt: Innertube, videoId: string) {
  for (const client of STREAM_CLIENTS) {
    const info = await yt.getBasicInfo(videoId, { client }).catch(() => null);

    if (info?.playability_status?.status === 'OK' && info.streaming_data) {
      return info;
    }
  }

  return null;
}

function expiryOf(url: string, now: number) {
  const expire = Number(new URL(url).searchParams.get('expire'));

  return Number.isFinite(expire) && expire > 0
    ? expire * 1000 - EXPIRY_MARGIN_MS
    : now + DEFAULT_LIFETIME_MS;
}

/** Deciphered googlevideo URLs, reused until they are about to expire. */
export class StreamResolver {
  #cache = new Map<string, ResolvedStream>();
  #now: () => number;

  constructor(now: () => number) {
    this.#now = now;
  }

  async #resolve(
    yt: Innertube,
    videoId: string,
    quality: AudioQuality,
  ): Promise<Result<ResolvedStream, MusicError>> {
    try {
      const info = await fetchPlayableInfo(yt, videoId);

      if (!info) {
        return err(MusicError.Unavailable);
      }

      const formats = (info.streaming_data?.adaptive_formats ?? [])
        .filter((format) => format.has_audio && !format.has_video)
        .map((format) => ({
          format,
          itag: format.itag,
          bitrate: format.bitrate,
          mimeType: format.mime_type,
          isDrc: format.is_drc ?? false,
        }));
      const picked = pickAudioFormat(formats, quality);

      if (!picked?.format.content_length) {
        return err(MusicError.Unavailable);
      }

      const url = await picked.format.decipher(yt.session.player);

      return ok({
        url,
        mimeType: picked.mimeType,
        itag: picked.itag,
        bitrate: picked.bitrate,
        contentLength: picked.format.content_length ?? 0,
        loudnessDb: picked.format.loudness_db ?? null,
        expiresAt: expiryOf(url, this.#now()),
      });
    } catch (error) {
      console.warn(
        `[stream] ${videoId}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return err(MusicError.Upstream);
    }
  }

  async resolve(yt: Innertube, cacheKey: string, videoId: string, quality: AudioQuality) {
    const key = `${cacheKey}:${videoId}:${quality}`;
    const cached = this.#cache.get(key);

    if (cached && cached.expiresAt > this.#now()) {
      return ok(cached);
    }

    const resolved = await this.#resolve(yt, videoId, quality);

    if (resolved.data) {
      this.#cache.set(key, resolved.data);
    }

    return resolved;
  }

  forget(cacheKey: string, videoId: string, quality: AudioQuality) {
    this.#cache.delete(`${cacheKey}:${videoId}:${quality}`);
  }
}
