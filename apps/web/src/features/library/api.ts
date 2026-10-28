import { PlaylistCreated } from '@lyra/shared';
import type { CreatePlaylistInput } from '@lyra/shared';

import { NoContent, api } from '../../lib/api.ts';

const path = (id: string) => encodeURIComponent(id);

export const likeTrack = (id: string) => api('PUT', `/music/likes/${path(id)}`, NoContent);

export const unlikeTrack = (id: string) => api('DELETE', `/music/likes/${path(id)}`, NoContent);

export const createPlaylist = (input: Partial<CreatePlaylistInput> & { title: string }) =>
  api('POST', '/music/playlists', PlaylistCreated, input);

export const renamePlaylist = (id: string, title: string) =>
  api('PATCH', `/music/playlists/${path(id)}`, NoContent, { title });

export const deletePlaylist = (id: string) =>
  api('DELETE', `/music/playlists/${path(id)}`, NoContent);

export const addToPlaylist = (id: string, trackIds: string[]) =>
  api('POST', `/music/playlists/${path(id)}/tracks`, NoContent, { trackIds });

export const removeFromPlaylist = (id: string, trackIds: string[]) =>
  api('DELETE', `/music/playlists/${path(id)}/tracks`, NoContent, { trackIds });
