import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  getAlbum,
  getArtist,
  getHome,
  getPlaylist,
  getSuggestions,
  getTrack,
  search,
} from '../catalog.ts';
import { InnertubePool } from '../innertube.ts';

// Hits the real YT Music API, so it only runs when asked: LYRA_LIVE=1 bun test.
const isLive = process.env['LYRA_LIVE'] === '1';
const TIMEOUT_MS = 60_000;

describe.skipIf(!isLive)('catalog (live)', () => {
  const pool = new InnertubePool(mkdtempSync(join(tmpdir(), 'lyra-live-')));
  const client = () => pool.get({ userId: null, cookie: null, language: 'en' });

  test(
    'home, search, album, artist and playlist map to non-empty pages',
    async () => {
      const yt = await client();

      const home = await getHome(yt);
      expect(home.data?.shelves.length).toBeGreaterThan(0);

      const songs = await search(yt, 'daft punk get lucky', 'songs');
      const song = songs.data?.items[0];
      expect(song?.kind).toBe('song');

      const track = await getTrack(yt, song?.id ?? '');
      expect(track.data?.id).toBe(song?.id);
      expect(track.data?.title).toBeTruthy();
      expect(track.data?.artists[0]?.name).toBe('Daft Punk');

      const albums = await search(yt, 'random access memories', 'albums');
      const albumId = albums.data?.items.find((item) => item.kind === 'album')?.id ?? '';
      const album = await getAlbum(yt, albumId);
      expect(album.data?.tracks.length).toBeGreaterThan(5);
      expect(album.data?.tracks[0]?.thumbnail).toBeTruthy();

      const artists = await search(yt, 'daft punk', 'artists');
      const artistId = artists.data?.items.find((item) => item.kind === 'artist')?.id ?? '';
      const artist = await getArtist(yt, artistId);
      expect(artist.data?.name).toBe('Daft Punk');
      expect(artist.data?.shelves.length).toBeGreaterThan(0);

      const playlists = await search(yt, 'lofi hip hop', 'playlists');
      const playlistId = playlists.data?.items.find((item) => item.kind === 'playlist')?.id ?? '';
      const playlist = await getPlaylist(yt, playlistId);
      expect(playlist.data?.tracks.length).toBeGreaterThan(5);

      const suggestions = await getSuggestions(yt, 'daft pu');
      expect(suggestions.data?.suggestions.length).toBeGreaterThan(0);

      const all = await search(yt, 'bad bunny', 'all');
      expect(new Set(all.data?.items.map((item) => item.kind)).size).toBeGreaterThan(1);
    },
    TIMEOUT_MS,
  );
});
