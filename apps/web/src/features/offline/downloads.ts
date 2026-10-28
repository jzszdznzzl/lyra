import { create } from 'zustand';

import { LyricsResponse } from '@lyra/shared';
import type { AudioQuality, Track } from '@lyra/shared';

import { api } from '../../lib/api.ts';
import { imageUrl } from '../../lib/image.ts';
import { AUDIO_CACHE, offlineAudioKey } from '../../offline/keys.ts';
import { DownloadRecord, offlineDb } from './db.ts';

interface DownloadsState {
  records: Map<string, DownloadRecord>;
  // 0..1 for songs downloading now or waiting in line.
  progress: Map<string, number>;
  failed: Set<string>;
  load: () => Promise<void>;
  download: (tracks: Track[], quality: AudioQuality) => void;
  remove: (ids: string[]) => Promise<void>;
}

let queue: Promise<void> = Promise.resolve();
let hasAskedForPersistence = false;

function lyricsPath(track: Track) {
  const params = new URLSearchParams({
    title: track.title,
    artist: track.artists.map((artist) => artist.name).join(', '),
    album: track.album?.name ?? '',
    duration: String(track.durationSeconds ?? 0),
  });

  return `/lyrics/${encodeURIComponent(track.id)}?${params.toString()}`;
}

async function fetchAudio(
  track: Track,
  quality: AudioQuality,
  onProgress: (fraction: number) => void,
) {
  const response = await fetch(`/api/stream/${encodeURIComponent(track.id)}?quality=${quality}`, {
    credentials: 'same-origin',
  });

  if (!response.ok || !response.body) {
    throw new Error(`download failed with ${response.status}`);
  }

  const total = Number(response.headers.get('content-length') ?? 0);
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    received += value.byteLength;

    if (total > 0) {
      onProgress(received / total);
    }
  }

  return new Blob(chunks, { type: response.headers.get('content-type') ?? 'audio/webm' });
}

/** Offline songs: audio in Cache Storage, metadata in IndexedDB, one download at a time. */
export const useDownloads = create<DownloadsState>()((set, get) => {
  function setProgress(id: string, fraction: number | null) {
    const progress = new Map(get().progress);

    if (fraction === null) {
      progress.delete(id);
    } else {
      progress.set(id, fraction);
    }

    set({ progress });
  }

  async function downloadOne(track: Track, quality: AudioQuality) {
    try {
      const blob = await fetchAudio(track, quality, (fraction) => setProgress(track.id, fraction));
      const cache = await caches.open(AUDIO_CACHE);
      await cache.put(
        offlineAudioKey(track.id),
        new Response(blob, {
          headers: { 'content-type': blob.type, 'content-length': String(blob.size) },
        }),
      );

      // Cover and lyrics too, so the offline library looks and feels complete.
      const cover = imageUrl(track.thumbnail);

      if (cover) {
        await fetch(cover, { credentials: 'same-origin' }).catch(() => undefined);
      }

      const lyrics = await api('GET', lyricsPath(track), LyricsResponse);

      if (lyrics.data) {
        await offlineDb.lyrics.put({ id: track.id, lyrics: lyrics.data.lyrics });
      }

      const record: DownloadRecord = {
        id: track.id,
        track,
        quality,
        bytes: blob.size,
        downloadedAt: Date.now(),
      };
      await offlineDb.downloads.put(record);

      const records = new Map(get().records);
      records.set(track.id, record);
      const failed = new Set(get().failed);
      failed.delete(track.id);
      set({ records, failed });
    } catch {
      set({ failed: new Set(get().failed).add(track.id) });
    } finally {
      setProgress(track.id, null);
    }
  }

  return {
    records: new Map(),
    progress: new Map(),
    failed: new Set(),
    load: async () => {
      const rows = await offlineDb.downloads.toArray().catch(() => []);
      const records = new Map<string, DownloadRecord>();

      for (const row of rows) {
        const parsed = DownloadRecord.safeParse(row);

        if (parsed.success) {
          records.set(parsed.data.id, parsed.data);
        }
      }

      set({ records });
    },
    download: (tracks, quality) => {
      const pending = tracks.filter(
        (track) => !get().records.has(track.id) && !get().progress.has(track.id),
      );

      if (pending.length === 0) {
        return;
      }

      if (!hasAskedForPersistence) {
        hasAskedForPersistence = true;
        // Without it the browser may evict downloads when space runs low.
        void navigator.storage?.persist?.().catch(() => false);
      }

      for (const track of pending) {
        setProgress(track.id, 0);
        queue = queue.then(() => downloadOne(track, quality));
      }
    },
    remove: async (ids) => {
      const cache = await caches.open(AUDIO_CACHE);
      await Promise.all(ids.map((id) => cache.delete(offlineAudioKey(id))));
      await offlineDb.downloads.bulkDelete(ids);
      await offlineDb.lyrics.bulkDelete(ids);

      const records = new Map(get().records);
      ids.forEach((id) => records.delete(id));
      set({ records });
    },
  };
});

export async function storageEstimate() {
  const estimate = await navigator.storage?.estimate?.().catch(() => null);

  return { used: estimate?.usage ?? 0, quota: estimate?.quota ?? 0 };
}

export async function offlineLyrics(id: string) {
  const row = await offlineDb.lyrics.get(id).catch(() => undefined);

  return row ? (LyricsResponse.safeParse({ lyrics: row.lyrics }).data ?? null) : null;
}
