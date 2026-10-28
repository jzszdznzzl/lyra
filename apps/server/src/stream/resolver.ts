import { MusicError, StreamType, err, ok } from '@lyra/shared';
import type { AudioQuality, Result } from '@lyra/shared';
import type { Innertube } from 'youtubei.js';

import { pickAudioFormat, pickVideoFormat } from './formats.ts';

export type StreamSelection =
  | { type: typeof StreamType.Audio; quality: AudioQuality }
  | { type: typeof StreamType.Video; height: number };

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

function selectionKey(selection: StreamSelection) {
  return selection.type === StreamType.Audio ? `a${selection.quality}` : `v${selection.height}`;
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
    selection: StreamSelection,
  ): Promise<Result<ResolvedStream, MusicError>> {
    try {
      const info = await fetchPlayableInfo(yt, videoId);

      if (!info) {
        return err(MusicError.Unavailable);
      }

      const adaptive = info.streaming_data?.adaptive_formats ?? [];
      const picked =
        selection.type === StreamType.Audio
          ? pickAudioFormat(
              adaptive
                .filter((format) => format.has_audio && !format.has_video)
                .map((format) => ({
                  format,
                  itag: format.itag,
                  bitrate: format.bitrate,
                  mimeType: format.mime_type,
                  isDrc: format.is_drc ?? false,
                })),
              selection.quality,
            )
          : pickVideoFormat(
              // Video plays muted next to the audio engine, so only video-only streams matter.
              adaptive
                .filter((format) => format.has_video && !format.has_audio && format.height)
                .map((format) => ({
                  format,
                  itag: format.itag,
                  bitrate: format.bitrate,
                  mimeType: format.mime_type,
                  isDrc: false,
                  height: format.height ?? 0,
                  codec: /codecs="([^"]+)"/.exec(format.mime_type)?.[1] ?? '',
                })),
              selection.height,
            );

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

  async resolve(yt: Innertube, cacheKey: string, videoId: string, selection: StreamSelection) {
    const key = `${cacheKey}:${videoId}:${selectionKey(selection)}`;
    const cached = this.#cache.get(key);

    if (cached && cached.expiresAt > this.#now()) {
      return ok(cached);
    }

    const resolved = await this.#resolve(yt, videoId, selection);

    if (resolved.data) {
      this.#cache.set(key, resolved.data);
    }

    return resolved;
  }

  forget(cacheKey: string, videoId: string, selection: StreamSelection) {
    this.#cache.delete(`${cacheKey}:${videoId}:${selectionKey(selection)}`);
  }
}
