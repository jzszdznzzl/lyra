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

export const MAX_FOLDER_NAME = 60;

/** A folder of downloaded songs; a song can be in several folders. */
export const FolderRecord = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(MAX_FOLDER_NAME),
  trackIds: z.array(z.string()),
  createdAt: z.number(),
});

export type FolderRecord = z.infer<typeof FolderRecord>;

/** Metadata of offline songs; the audio itself lives in Cache Storage (see offline/keys.ts). */
class OfflineDb extends Dexie {
  downloads: EntityTable<DownloadRecord, 'id'>;
  lyrics: EntityTable<LyricsRecord, 'id'>;
  folders: EntityTable<FolderRecord, 'id'>;

  constructor() {
    super('lyra-offline');
    this.version(1).stores({ downloads: 'id, downloadedAt', lyrics: 'id' });
    this.version(2).stores({ folders: 'id, createdAt' });
    this.downloads = this.table('downloads');
    this.lyrics = this.table('lyrics');
    this.folders = this.table('folders');
  }
}

export const offlineDb = new OfflineDb();
