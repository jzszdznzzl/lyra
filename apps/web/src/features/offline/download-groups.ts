import type { Track } from '@lyra/shared';

/** Downloaded songs that share an album or an artist. */
export interface DownloadGroup {
  key: string;
  name: string;
  thumbnail: string | null;
  tracks: Track[];
}

export const DownloadGroupKind = Object.freeze({
  Folder: 'folder',
  Album: 'album',
  Artist: 'artist',
} as const);

export type DownloadGroupKind = (typeof DownloadGroupKind)[keyof typeof DownloadGroupKind];

// Albums and artists without a YouTube id are grouped by name, behind this prefix.
const NAME_KEY_PREFIX = 'name:';

const keyFor = (id: string | null, name: string) => id ?? `${NAME_KEY_PREFIX}${name}`;

function addTo(groups: Map<string, DownloadGroup>, key: string, name: string, track: Track) {
  const group = groups.get(key);

  if (group) {
    group.tracks.push(track);
  } else {
    groups.set(key, { key, name, thumbnail: track.thumbnail, tracks: [track] });
  }
}

function sorted(groups: Map<string, DownloadGroup>) {
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Downloads by album, sorted by name. Songs without an album are left out. */
export function groupByAlbum(tracks: readonly Track[]) {
  const groups = new Map<string, DownloadGroup>();

  for (const track of tracks) {
    if (track.album) {
      addTo(groups, keyFor(track.album.id, track.album.name), track.album.name, track);
    }
  }

  return sorted(groups);
}

/** Downloads by artist, sorted by name. A song with several artists is under each of them. */
export function groupByArtist(tracks: readonly Track[]) {
  const groups = new Map<string, DownloadGroup>();

  for (const track of tracks) {
    for (const artist of track.artists) {
      addTo(groups, keyFor(artist.id, artist.name), artist.name, track);
    }
  }

  return sorted(groups);
}
