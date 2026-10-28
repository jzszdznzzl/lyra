import { queryOptions } from '@tanstack/react-query';

import {
  AlbumPage,
  ArtistPage,
  HomeFeed,
  LibraryPlaylists,
  PlaylistPage,
  SearchResults,
  SearchSuggestions,
} from '@lyra/shared';
import type { SearchFilter } from '@lyra/shared';

import { api, unwrap } from '../../lib/api.ts';

const MINUTE_MS = 60 * 1000;

const path = (id: string) => encodeURIComponent(id);

export const homeQuery = queryOptions({
  queryKey: ['music', 'home'],
  queryFn: async () => unwrap(await api('GET', '/music/home', HomeFeed)),
  staleTime: 10 * MINUTE_MS,
});

export const searchQuery = (q: string, filter: SearchFilter) =>
  queryOptions({
    queryKey: ['music', 'search', q, filter],
    queryFn: async () =>
      unwrap(
        await api(
          'GET',
          `/music/search?${new URLSearchParams({ q, filter }).toString()}`,
          SearchResults,
        ),
      ),
    staleTime: 5 * MINUTE_MS,
    enabled: q.trim() !== '',
  });

export const suggestionsQuery = (q: string) =>
  queryOptions({
    queryKey: ['music', 'suggestions', q],
    queryFn: async () =>
      unwrap(
        await api(
          'GET',
          `/music/suggestions?${new URLSearchParams({ q }).toString()}`,
          SearchSuggestions,
        ),
      ),
    staleTime: 5 * MINUTE_MS,
    enabled: q.trim() !== '',
  });

export const albumQuery = (id: string) =>
  queryOptions({
    queryKey: ['music', 'album', id],
    queryFn: async () => unwrap(await api('GET', `/music/albums/${path(id)}`, AlbumPage)),
    staleTime: 60 * MINUTE_MS,
  });

export const artistQuery = (id: string) =>
  queryOptions({
    queryKey: ['music', 'artist', id],
    queryFn: async () => unwrap(await api('GET', `/music/artists/${path(id)}`, ArtistPage)),
    staleTime: 30 * MINUTE_MS,
  });

export const playlistQuery = (id: string) =>
  queryOptions({
    queryKey: ['music', 'playlist', id],
    queryFn: async () => unwrap(await api('GET', `/music/playlists/${path(id)}`, PlaylistPage)),
    staleTime: 5 * MINUTE_MS,
  });

export const likedQuery = queryOptions({
  queryKey: ['music', 'liked'],
  queryFn: async () => unwrap(await api('GET', '/music/liked', PlaylistPage)),
  staleTime: 5 * MINUTE_MS,
});

export const libraryPlaylistsQuery = queryOptions({
  queryKey: ['music', 'library', 'playlists'],
  queryFn: async () => unwrap(await api('GET', '/music/library/playlists', LibraryPlaylists)),
  staleTime: 5 * MINUTE_MS,
});
