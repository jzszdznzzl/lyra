import { Dexie } from 'dexie';
import type { EntityTable } from 'dexie';
import { z } from 'zod';

import { AudioQuality, Lyrics, Track } from '@lyra/shared';

export const DownloadRecord = z.object({
  id: z.string(),
  track: Track,
  quality: z.enum(AudioQuality),
  bytes: z.number(),
  downloadedAt: z.number(),
});

export type DownloadRecord = z.infer<typeof DownloadRecord>;

export const LyricsRecord = z.object({ id: z.string(), lyrics: Lyrics.nullable() });

export type LyricsRecord = z.infer<typeof LyricsRecord>;

/** Metadata of offline songs; the audio itself lives in Cache Storage (see offline/keys.ts). */
class OfflineDb extends Dexie {
  downloads: EntityTable<DownloadRecord, 'id'>;
  lyrics: EntityTable<LyricsRecord, 'id'>;

  constructor() {
    super('lyra-offline');
    this.version(1).stores({ downloads: 'id, downloadedAt', lyrics: 'id' });
    this.downloads = this.table('downloads');
    this.lyrics = this.table('lyrics');
  }
}

export const offlineDb = new OfflineDb();
