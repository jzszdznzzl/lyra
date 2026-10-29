import { create } from 'zustand';

import { FolderRecord, offlineDb } from './db.ts';

interface FoldersState {
  folders: Map<string, FolderRecord>;
  load: () => Promise<void>;
  /** Creates a folder, optionally with songs in it, and returns its id. */
  create: (name: string, trackIds?: string[]) => Promise<string | null>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addTracks: (id: string, trackIds: string[]) => Promise<void>;
  removeTracks: (id: string, trackIds: string[]) => Promise<void>;
  /** Takes deleted downloads out of every folder. */
  forgetTracks: (trackIds: string[]) => Promise<void>;
}

/** Folders sorted by name, as people look for them. */
export function sortedFolders(folders: Map<string, FolderRecord>) {
  return [...folders.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Folders of downloaded songs, kept on this device next to the downloads themselves. */
export const useFolders = create<FoldersState>()((set, get) => {
  async function save(folder: FolderRecord) {
    const parsed = FolderRecord.safeParse(folder);

    if (!parsed.success) {
      return false;
    }

    await offlineDb.folders.put(parsed.data);
    set({ folders: new Map(get().folders).set(parsed.data.id, parsed.data) });

    return true;
  }

  async function update(id: string, change: (folder: FolderRecord) => FolderRecord) {
    const folder = get().folders.get(id);

    if (folder) {
      await save(change(folder));
    }
  }

  return {
    folders: new Map(),
    load: async () => {
      const rows = await offlineDb.folders.toArray().catch(() => []);
      const folders = new Map<string, FolderRecord>();

      for (const row of rows) {
        const parsed = FolderRecord.safeParse(row);

        if (parsed.success) {
          folders.set(parsed.data.id, parsed.data);
        }
      }

      set({ folders });
    },
    create: async (name, trackIds = []) => {
      const folder = { id: crypto.randomUUID(), name, trackIds, createdAt: Date.now() };

      return (await save(folder)) ? folder.id : null;
    },
    rename: (id, name) => update(id, (folder) => ({ ...folder, name })),
    remove: async (id) => {
      await offlineDb.folders.delete(id);
      const folders = new Map(get().folders);
      folders.delete(id);
      set({ folders });
    },
    addTracks: (id, trackIds) =>
      update(id, (folder) => ({
        ...folder,
        trackIds: [
          ...folder.trackIds,
          ...trackIds.filter((trackId) => !folder.trackIds.includes(trackId)),
        ],
      })),
    removeTracks: (id, trackIds) =>
      update(id, (folder) => ({
        ...folder,
        trackIds: folder.trackIds.filter((trackId) => !trackIds.includes(trackId)),
      })),
    forgetTracks: async (trackIds) => {
      const affected = [...get().folders.values()].filter((folder) =>
        folder.trackIds.some((trackId) => trackIds.includes(trackId)),
      );

      for (const folder of affected) {
        await get().removeTracks(folder.id, trackIds);
      }
    },
  };
});
