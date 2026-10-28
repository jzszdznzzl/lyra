import { MusicError, StreamType, err, ok } from '@lyra/shared';
import type { AudioContainer, AudioQuality, Result } from '@lyra/shared';
import type { Innertube } from 'youtubei.js';

import { pickAudioFormat, pickVideoFormat } from './formats.ts';
import type { PoTokenMinter } from '../ytmusic/po-token.ts';

export type StreamSelection =
  | { type: typeof StreamType.Audio; quality: AudioQuality; container?: AudioContainer }
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

// YouTube's answer when it wants a signed-in session, e.g. its bot check on datacenter IPs.
const LOGIN_REQUIRED = 'LOGIN_REQUIRED';
// Leave a margin so a song that starts near expiry still finishes.
const EXPIRY_MARGIN_MS = 10 * 60 * 1000;
const DEFAULT_LIFETIME_MS = 60 * 60 * 1000;

/**
 * The visionOS client needs no PO token, but YouTube rejects it with cookies and, from
 * datacenter IPs, without them. YT Music's own client works signed in, but googlevideo cuts its
 * streams after the first MiB unless the URL carries a PO token bound to the video.
 */
async function fetchPlayableInfo(yt: Innertube, videoId: string, poTokens: PoTokenMinter) {
  const isSignedIn = yt.session.logged_in;
  const statuses: string[] = [];

  if (!isSignedIn) {
    const info = await yt.getBasicInfo(videoId, { client: 'VISIONOS' }).catch(() => null);
    statuses.push(info?.playability_status?.status ?? '');

    if (info?.playability_status?.status === 'OK' && info.streaming_data) {
      return ok({ info, poToken: null });
    }
  }

  const poToken = await poTokens.mint(yt, videoId);
  const info = await yt
    .getBasicInfo(videoId, { client: 'YTMUSIC', ...(poToken ? { po_token: poToken } : {}) })
    .catch(() => null);
  statuses.push(info?.playability_status?.status ?? '');

  if (info?.playability_status?.status === 'OK' && info.streaming_data) {
    return ok({ info, poToken });
  }

  // Every client asking for a sign-in means the session is the problem, not the song.
  if (statuses.every((status) => status === LOGIN_REQUIRED)) {
    return err(isSignedIn ? MusicError.GoogleSessionExpired : MusicError.GoogleNotLinked);
  }

  return err(MusicError.Unavailable);
}

function selectionKey(selection: StreamSelection) {
  return selection.type === StreamType.Audio
    ? `a${selection.quality}${selection.container ?? ''}`
    : `v${selection.height}`;
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
  #poTokens: PoTokenMinter;

  constructor(now: () => number, poTokens: PoTokenMinter) {
    this.#now = now;
    this.#poTokens = poTokens;
  }

  async #resolve(
    yt: Innertube,
    videoId: string,
    selection: StreamSelection,
  ): Promise<Result<ResolvedStream, MusicError>> {
    try {
      const playable = await fetchPlayableInfo(yt, videoId, this.#poTokens);

      if (playable.error) {
        return err(playable.error);
      }

      const { info, poToken } = playable.data;

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
              selection.container,
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

      const deciphered = new URL(await picked.format.decipher(yt.session.player));

      // Added here rather than through the shared player, which concurrent songs would race on.
      if (poToken) {
        deciphered.searchParams.set('pot', poToken);
      }

      const url = deciphered.toString();

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
