import { YTNodes } from 'youtubei.js';
import type { Innertube } from 'youtubei.js';

import { MediaKind, MusicError, SearchFilter, err, ok } from '@lyra/shared';
import type {
  AlbumPage,
  ArtistPage,
  HomeFeed,
  LibraryPlaylists,
  PlaylistCard,
  PlaylistPage,
  Result,
  SearchResults,
  Track,
} from '@lyra/shared';

import { describeHeader } from './headers.ts';
import { toMediaItems, toShelves, toTracks } from './mappers.ts';

const SEARCH_TYPES = {
  [SearchFilter.All]: 'all',
  [SearchFilter.Songs]: 'song',
  [SearchFilter.Videos]: 'video',
  [SearchFilter.Albums]: 'album',
  [SearchFilter.Artists]: 'artist',
  [SearchFilter.Playlists]: 'playlist',
} as const satisfies Record<SearchFilter, string>;

// Liked songs can run into thousands; past this the page stops loading continuations.
const MAX_PLAYLIST_TRACKS = 5000;
const LIKED_MUSIC_ID = 'LM';
const BROWSE_PLAYLIST_PREFIX = 'VL';
const HTTP_NOT_FOUND = /404|not found|does not exist/i;

/** Normalizes youtubei.js failures into domain errors; real bugs still surface in the log. */
async function attempt<T>(task: () => Promise<T>): Promise<Result<T, MusicError>> {
  try {
    return ok(await task());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ytmusic] ${message}`);

    return err(HTTP_NOT_FOUND.test(message) ? MusicError.NotFound : MusicError.Upstream);
  }
}

export function getHome(yt: Innertube): Promise<Result<HomeFeed, MusicError>> {
  return attempt(async () => {
    const feed = await yt.music.getHomeFeed();

    return { shelves: toShelves(feed.sections) };
  });
}

export function search(
  yt: Innertube,
  query: string,
  filter: SearchFilter,
): Promise<Result<SearchResults, MusicError>> {
  return attempt(async () => {
    const results = await yt.music.search(query, { type: SEARCH_TYPES[filter] });
    const nodes = (results.contents ?? []).flatMap((section) => section.contents ?? []);

    return { items: toMediaItems(nodes) };
  });
}

export function getSuggestions(yt: Innertube, query: string) {
  return attempt(async () => {
    const sections = await yt.music.getSearchSuggestions(query);
    const suggestions = sections.flatMap((section) =>
      section.contents.flatMap((node) =>
        node.is(YTNodes.SearchSuggestion) ? [node.suggestion.toString()] : [],
      ),
    );

    return { suggestions };
  });
}

export function getAlbum(yt: Innertube, id: string): Promise<Result<AlbumPage, MusicError>> {
  return attempt(async () => {
    const album = await yt.music.getAlbum(id);
    const header = describeHeader(album.header);
    const playlistId = album.url ? new URL(album.url).searchParams.get('list') : null;
    // Album rows omit the artwork and sometimes the artists; they share the album's.
    const tracks = toTracks(album.contents).map((track) => ({
      ...track,
      thumbnail: track.thumbnail ?? header.thumbnail,
      album: track.album ?? { id, name: header.title },
    }));

    return { id, ...header, playlistId, tracks };
  });
}

export function getArtist(yt: Innertube, id: string): Promise<Result<ArtistPage, MusicError>> {
  return attempt(async () => {
    const artist = await yt.music.getArtist(id);
    const header = describeHeader(artist.header);

    return {
      id,
      name: header.title,
      subtitle: header.subtitle,
      thumbnail: header.thumbnail,
      shelves: toShelves(artist.sections),
    };
  });
}

export function getPlaylist(yt: Innertube, id: string): Promise<Result<PlaylistPage, MusicError>> {
  return attempt(async () => {
    let page = await yt.music.getPlaylist(id);
    const header = describeHeader(page.header);
    const isEditable = page.header?.is(YTNodes.MusicEditablePlaylistDetailHeader) ?? false;
    const tracks: Track[] = toTracks(page.items);

    while (page.has_continuation && tracks.length < MAX_PLAYLIST_TRACKS) {
      page = await page.getContinuation();
      tracks.push(...toTracks(page.items));
    }

    return {
      id: id.replace(new RegExp(`^${BROWSE_PLAYLIST_PREFIX}`), ''),
      ...header,
      isEditable,
      tracks,
    };
  });
}

export function getLikedSongs(yt: Innertube) {
  return getPlaylist(yt, LIKED_MUSIC_ID);
}

export function getLibraryPlaylists(yt: Innertube): Promise<Result<LibraryPlaylists, MusicError>> {
  return attempt(async () => {
    const library = await yt.music.getLibrary();
    const nodes = (library.contents ?? []).flatMap((section) => section.contents ?? []);
    const playlists = toMediaItems(nodes).filter(
      (item): item is PlaylistCard => item.kind === MediaKind.Playlist,
    );

    return { playlists };
  });
}
