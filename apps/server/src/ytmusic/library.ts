import type { Innertube } from 'youtubei.js';

import { MusicError, err, ok } from '@lyra/shared';
import { errorMessage, moduleLogger } from '../logger.ts';
import type { CreatePlaylistInput, PlaylistCreated, Result } from '@lyra/shared';

// YT Music shows playlists as "VL" + id; the editing endpoints want the bare id.
const BROWSE_PREFIX = /^VL/;
// Endpoints are called as music.youtube.com does, the same requests ytmusicapi sends.
const CLIENT = 'YTMUSIC';

const log = moduleLogger('library');

function playlistId(id: string) {
  return id.replace(BROWSE_PREFIX, '');
}

async function write<T>(label: string, task: () => Promise<T>): Promise<Result<T, MusicError>> {
  try {
    return ok(await task());
  } catch (error) {
    log.warn(`${label}: ${errorMessage(error)}`);

    return err(MusicError.Upstream);
  }
}

async function editPlaylist(yt: Innertube, id: string, actions: Record<string, string>[]) {
  const response = await yt.actions.execute('/browse/edit_playlist', {
    playlistId: playlistId(id),
    actions,
    client: CLIENT,
  });

  if (!response.success) {
    throw new Error(`edit_playlist answered ${response.status_code}`);
  }
}

async function rate(yt: Innertube, endpoint: '/like/like' | '/like/removelike', videoId: string) {
  // youtubei.js sends these with the web client, which YouTube now answers with 400.
  const response = await yt.actions.execute(endpoint, { target: { videoId }, client: CLIENT });

  if (!response.success) {
    throw new Error(`${endpoint} answered ${response.status_code}`);
  }
}

export function likeTrack(yt: Innertube, videoId: string) {
  return write('like', async () => {
    await rate(yt, '/like/like', videoId);

    return null;
  });
}

export function unlikeTrack(yt: Innertube, videoId: string) {
  return write('unlike', async () => {
    await rate(yt, '/like/removelike', videoId);

    return null;
  });
}

export function createPlaylist(
  yt: Innertube,
  input: CreatePlaylistInput,
): Promise<Result<PlaylistCreated, MusicError>> {
  return write('create playlist', async () => {
    const created = await yt.playlist.create(
      input.title,
      input.trackIds,
      input.privacy,
      input.description,
    );

    if (!created.playlist_id) {
      throw new Error('no playlist id in the answer');
    }

    return { id: created.playlist_id };
  });
}

export function renamePlaylist(yt: Innertube, id: string, title: string) {
  return write('rename playlist', async () => {
    await editPlaylist(yt, id, [{ action: 'ACTION_SET_PLAYLIST_NAME', playlistName: title }]);

    return null;
  });
}

export function deletePlaylist(yt: Innertube, id: string) {
  return write('delete playlist', async () => {
    const response = await yt.actions.execute('/playlist/delete', {
      playlistId: playlistId(id),
      client: CLIENT,
    });

    if (!response.success) {
      throw new Error(`playlist/delete answered ${response.status_code}`);
    }

    return null;
  });
}

export function addTracks(yt: Innertube, id: string, trackIds: string[]) {
  return write('add tracks', async () => {
    await editPlaylist(
      yt,
      id,
      trackIds.map((videoId) => ({
        action: 'ACTION_ADD_VIDEO',
        addedVideoId: videoId,
        dedupeOption: 'DEDUPE_OPTION_SKIP',
      })),
    );

    return null;
  });
}

export function removeTracks(yt: Innertube, id: string, trackIds: string[]) {
  return write('remove tracks', async () => {
    // Removing by video id needs no per-entry ids, which the playlist pages no longer include.
    await editPlaylist(
      yt,
      id,
      trackIds.map((videoId) => ({
        action: 'ACTION_REMOVE_VIDEO_BY_VIDEO_ID',
        removedVideoId: videoId,
      })),
    );

    return null;
  });
}

/**
 * Adds a song to the account's YouTube history, as music.youtube.com does once a song plays:
 * a ping to the stats URL that comes with the player response. History is what YouTube Music
 * bases the home page and recommendations on.
 */
export function addToHistory(yt: Innertube, videoId: string) {
  return write('add to history', async () => {
    const info = await yt.music.getInfo(videoId);
    const response = await info.addToWatchHistory();

    if (!response.ok) {
      throw new Error(`history ping answered ${response.status}`);
    }

    return null;
  });
}
