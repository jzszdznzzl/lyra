import { YTNodes } from 'youtubei.js';
import type { Helpers } from 'youtubei.js';

import { MediaKind } from '@lyra/shared';
import type { ArtistRef, MediaItem, Shelf, Track } from '@lyra/shared';

type Thumbnail = { url: string; width: number; height: number };
type ArtistLike = { name: string; channel_id?: string | undefined };

const EXPLICIT_BADGE = 'MUSIC_EXPLICIT_BADGE';
const THUMBNAIL_SIZE = 544;
// YouTube image URLs end in a size directive such as `=w120-h120-l90-rj`; it can be rewritten.
const SIZE_DIRECTIVE = /=w\d+-h\d+[^/]*$/;
const DURATION_PART = /^\d+$/;

/** Picks the largest thumbnail and asks the CDN for a sharper copy when it can. */
export function bestThumbnail(thumbnails: readonly Thumbnail[] | undefined) {
  const largest = [...(thumbnails ?? [])].sort((a, b) => b.width - a.width)[0];

  if (!largest) {
    return null;
  }

  const url = largest.url.startsWith('//') ? `https:${largest.url}` : largest.url;

  return SIZE_DIRECTIVE.test(url)
    ? url.replace(SIZE_DIRECTIVE, `=w${THUMBNAIL_SIZE}-h${THUMBNAIL_SIZE}-l90-rj`)
    : url;
}

/** "3:45" or "1:02:03" → seconds; null for anything else. */
export function parseDuration(text: string | undefined) {
  const parts = text?.split(':') ?? [];

  if (parts.length < 2 || !parts.every((part) => DURATION_PART.test(part))) {
    return null;
  }

  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

function toArtists(artists: readonly ArtistLike[] | undefined): ArtistRef[] {
  return (artists ?? []).map((artist) => ({ id: artist.channel_id ?? null, name: artist.name }));
}

function isExplicit(badges: readonly Helpers.YTNode[] | null | undefined) {
  return (badges ?? []).some(
    (badge) => badge.is(YTNodes.MusicInlineBadge) && badge.icon_type === EXPLICIT_BADGE,
  );
}

function badgeList(badges: Helpers.SuperParsedResult | null) {
  if (!badges || badges.is_null) {
    return [];
  }

  return badges.is_array ? badges.array() : [badges.item()];
}

function fromListItem(item: YTNodes.MusicResponsiveListItem): MediaItem | null {
  const thumbnail = bestThumbnail(item.thumbnails);
  const subtitle = item.subtitle?.toString() ?? '';

  switch (item.item_type) {
    case 'song':
    case 'video':
    case 'non_music_track': {
      if (!item.id) {
        return null;
      }

      return {
        kind: item.item_type === 'video' ? MediaKind.Video : MediaKind.Song,
        id: item.id,
        title: item.title ?? '',
        artists: toArtists(item.artists ?? item.authors),
        album: item.album ? { id: item.album.id ?? null, name: item.album.name } : null,
        durationSeconds: item.duration?.seconds ?? null,
        thumbnail,
        isExplicit: isExplicit(item.badges),
      };
    }
    case 'album': {
      return item.id
        ? { kind: MediaKind.Album, id: item.id, title: item.title ?? '', subtitle, thumbnail }
        : null;
    }
    case 'artist':
    case 'library_artist': {
      return item.id
        ? {
            kind: MediaKind.Artist,
            id: item.id,
            title: item.name ?? item.title ?? '',
            subtitle: item.subscribers ?? subtitle,
            thumbnail,
          }
        : null;
    }
    case 'playlist': {
      return item.id
        ? { kind: MediaKind.Playlist, id: item.id, title: item.title ?? '', subtitle, thumbnail }
        : null;
    }
    default: {
      return null;
    }
  }
}

function fromTwoRowItem(item: YTNodes.MusicTwoRowItem): MediaItem | null {
  if (!item.id) {
    return null;
  }

  const title = item.title.toString();
  const subtitle = item.subtitle.toString();
  const thumbnail = bestThumbnail(item.thumbnail);

  switch (item.item_type) {
    case 'song':
    case 'video': {
      return {
        kind: item.item_type === 'video' ? MediaKind.Video : MediaKind.Song,
        id: item.id,
        title,
        artists: toArtists(item.artists ?? (item.author ? [item.author] : [])),
        album: null,
        durationSeconds: null,
        thumbnail,
        isExplicit: isExplicit(badgeList(item.badges)),
      };
    }
    case 'album': {
      return { kind: MediaKind.Album, id: item.id, title, subtitle, thumbnail };
    }
    case 'artist': {
      return { kind: MediaKind.Artist, id: item.id, title, subtitle, thumbnail };
    }
    case 'playlist': {
      return { kind: MediaKind.Playlist, id: item.id, title, subtitle, thumbnail };
    }
    default: {
      return null;
    }
  }
}

/** Converts any supported YT Music node to a media item; unknown nodes become null. */
export function toMediaItem(node: Helpers.YTNode): MediaItem | null {
  if (node.is(YTNodes.MusicResponsiveListItem)) {
    return fromListItem(node);
  }

  if (node.is(YTNodes.MusicTwoRowItem)) {
    return fromTwoRowItem(node);
  }

  return null;
}

export function toMediaItems(nodes: readonly Helpers.YTNode[] | null | undefined) {
  return (nodes ?? []).flatMap((node) => {
    const item = toMediaItem(node);

    return item ? [item] : [];
  });
}

export function toTracks(nodes: readonly Helpers.YTNode[] | null | undefined): Track[] {
  return toMediaItems(nodes).filter(
    (item): item is Track => item.kind === MediaKind.Song || item.kind === MediaKind.Video,
  );
}

/** Maps carousel and list shelves; empty or unsupported shelves are dropped. */
export function toShelves(sections: readonly Helpers.YTNode[] | null | undefined): Shelf[] {
  return (sections ?? []).flatMap((section) => {
    let title = '';
    let contents: readonly Helpers.YTNode[] = [];

    if (section.is(YTNodes.MusicCarouselShelf)) {
      title = section.header?.title.toString() ?? '';
      contents = section.contents;
    } else if (section.is(YTNodes.MusicShelf)) {
      title = section.title.toString();
      contents = section.contents;
    }

    const items = toMediaItems(contents);

    return items.length > 0 ? [{ title, items }] : [];
  });
}
