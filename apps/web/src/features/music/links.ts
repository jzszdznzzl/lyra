import { MediaKind } from '@lyra/shared';
import type { MediaItem, Track } from '@lyra/shared';

/** Where a card leads; tracks have no page of their own and play instead. */
export function linkFor(item: MediaItem) {
  switch (item.kind) {
    case MediaKind.Album: {
      return { to: '/album/$id', params: { id: item.id } } as const;
    }
    case MediaKind.Artist: {
      return { to: '/artist/$id', params: { id: item.id } } as const;
    }
    case MediaKind.Playlist: {
      return { to: '/playlist/$id', params: { id: item.id } } as const;
    }
    default: {
      return null;
    }
  }
}

export function isTrack(item: MediaItem): item is Track {
  return item.kind === MediaKind.Song || item.kind === MediaKind.Video;
}
