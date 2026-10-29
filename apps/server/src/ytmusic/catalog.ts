import { Parser, YTMusic, YTNodes } from 'youtubei.js';
import type { Helpers, Innertube } from 'youtubei.js';

import { MediaKind, MusicError, SearchFilter, err, ok } from '@lyra/shared';
import type {
  AlbumPage,
  ArtistPage,
  HomeFeed,
  LibraryPlaylists,
  ListeningHistory,
  MediaItem,
  PlaylistCard,
  PlaylistPage,
  Result,
  SearchResults,
  Track,
  UpNext,
} from '@lyra/shared';

import { describeHeader } from './headers.ts';
import { bestThumbnail, toMediaItems, toShelves, toTracks } from './mappers.ts';
import { moduleLogger } from '../logger.ts';

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
const LIBRARY_PLAYLISTS_ID = 'FEmusic_liked_playlists';
const HISTORY_ID = 'FEmusic_history';
// Liked songs has its own entry; "Episodes for later" holds podcasts, not music.
const HIDDEN_LIBRARY_PLAYLISTS = new Set(['VLLM', 'LM', 'VLSE', 'SE']);
const BROWSE_PLAYLIST_PREFIX = 'VL';
const HTTP_NOT_FOUND = /404|not found|does not exist/i;

const log = moduleLogger('ytmusic');

/** Normalizes youtubei.js failures into domain errors; real bugs still surface in the log. */
async function attempt<T>(task: () => Promise<T>): Promise<Result<T, MusicError>> {
  try {
    return ok(await task());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(message);

    return err(HTTP_NOT_FOUND.test(message) ? MusicError.NotFound : MusicError.Upstream);
  }
}

function toPanelTracks(nodes: readonly Helpers.YTNode[]): Track[] {
  return nodes.flatMap((node): Track[] => {
    const video = node.is(YTNodes.PlaylistPanelVideoWrapper) ? node.primary : node;

    if (!video?.is(YTNodes.PlaylistPanelVideo)) {
      return [];
    }

    return [
      {
        kind: MediaKind.Song,
        id: video.video_id,
        title: video.title.toString(),
        artists: (video.artists ?? []).map((artist) => ({
          id: artist.channel_id ?? null,
          name: artist.name,
        })),
        album: video.album ? { id: video.album.id ?? null, name: video.album.name } : null,
        durationSeconds: video.duration.seconds || null,
        thumbnail: bestThumbnail(video.thumbnail),
        isExplicit: false,
      },
    ];
  });
}

export function getHome(yt: Innertube): Promise<Result<HomeFeed, MusicError>> {
  return attempt(async () => {
    const feed = await yt.music.getHomeFeed();

    return { shelves: toShelves(feed.sections) };
  });
}

const ARTIST_ID = /^UC[\w-]{22}$/;
const ALBUM_ID = /^MPRE/;

/**
 * The top result card (an artist or album) plus the songs under it. Those songs come without
 * artists, since the card already names them, so the card's artist is filled in.
 */
function topResult(card: YTNodes.MusicCardShelf): MediaItem[] {
  const payload: unknown = card.on_tap.payload;
  const browseId =
    typeof payload === 'object' &&
    payload !== null &&
    'browseId' in payload &&
    typeof payload.browseId === 'string'
      ? payload.browseId
      : null;
  const title = card.title.toString();
  const thumbnail = bestThumbnail(card.thumbnail?.contents);
  const subtitle = card.subtitle.toString();
  const items: MediaItem[] = [];

  if (browseId && ARTIST_ID.test(browseId)) {
    items.push({ kind: MediaKind.Artist, id: browseId, title, subtitle, thumbnail });
  } else if (browseId && ALBUM_ID.test(browseId)) {
    items.push({ kind: MediaKind.Album, id: browseId, title, subtitle, thumbnail });
  }

  const artist = browseId && ARTIST_ID.test(browseId) ? { id: browseId, name: title } : null;

  for (const item of toMediaItems(card.contents ?? [])) {
    items.push(
      artist &&
        (item.kind === MediaKind.Song || item.kind === MediaKind.Video) &&
        item.artists.length === 0
        ? { ...item, artists: [artist] }
        : item,
    );
  }

  return items;
}

/**
 * One song by id, for shared links. It comes from the up-next queue rather than the player:
 * YouTube asks anonymous players on datacenter IPs to sign in, but still answers this.
 */
export function getTrack(yt: Innertube, videoId: string): Promise<Result<Track, MusicError>> {
  return attempt(async () => {
    const panel = await yt.music.getUpNext(videoId, false);
    const track = toPanelTracks(panel.contents).find((candidate) => candidate.id === videoId);

    if (!track) {
      throw new Error(`song ${videoId} not found`);
    }

    return track;
  });
}

export function getExplore(yt: Innertube): Promise<Result<HomeFeed, MusicError>> {
  return attempt(async () => {
    const explore = await yt.music.getExplore();

    return { shelves: toShelves(explore.sections) };
  });
}

export function search(
  yt: Innertube,
  query: string,
  filter: SearchFilter,
): Promise<Result<SearchResults, MusicError>> {
  return attempt(async () => {
    const results = await yt.music.search(query, { type: SEARCH_TYPES[filter] });
    const items = (results.contents ?? []).flatMap((section) =>
      section.is(YTNodes.MusicCardShelf)
        ? topResult(section)
        : toMediaItems(section.contents ?? []),
    );

    return { items };
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
    // The editable header is not always the one youtubei.js picks; it is still in the memo.
    const isEditable = page.page.contents_memo?.has('MusicEditablePlaylistDetailHeader') ?? false;
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
    // The library landing page is only a summary; this browse lists every saved playlist.
    const response = await yt.actions.execute('/browse', {
      browseId: LIBRARY_PLAYLISTS_ID,
      client: 'YTMUSIC',
    });
    const library = new YTMusic.Library(response, yt.actions);
    const nodes = (library.contents ?? []).flatMap((section) => section.contents ?? []);
    let page = library.has_continuation ? await library.getContinuation() : null;

    while (page) {
      nodes.push(...(page.contents.contents ?? []));
      page = page.has_continuation ? await page.getContinuation() : null;
    }

    const playlists = toMediaItems(nodes).filter(
      (item): item is PlaylistCard =>
        item.kind === MediaKind.Playlist && !HIDDEN_LIBRARY_PLAYLISTS.has(item.id),
    );

    return { playlists };
  });
}

/** The account's YT Music history: every song heard, in Lyra or anywhere else. */
export function getHistory(yt: Innertube): Promise<Result<ListeningHistory, MusicError>> {
  return attempt(async () => {
    const response = await yt.actions.execute('/browse', {
      browseId: HISTORY_ID,
      client: 'YTMUSIC',
    });
    // Parsed by hand: YTMusic.Library rejects the history page's header (a chip cloud).
    const page = Parser.parseResponse(response.data);
    const shelves = page.contents_memo?.getType(YTNodes.MusicShelf) ?? [];
    const sections = shelves.flatMap((shelf) => {
      const tracks = toTracks(shelf.contents);

      return tracks.length > 0 ? [{ title: shelf.title.toString(), tracks }] : [];
    });

    return { sections };
  });
}

/** What YT Music would play after this track: its radio, starting with the track itself. */
export function getUpNext(yt: Innertube, videoId: string): Promise<Result<UpNext, MusicError>> {
  return attempt(async () => {
    const panel = await yt.music.getUpNext(videoId, true);
    const tracks = toPanelTracks(panel.contents);

    return { tracks };
  });
}

const OFFICIAL_VIDEO = /\b(official (music )?video|video oficial|videoclip oficial)\b/;
const NOT_A_MUSIC_VIDEO =
  /\b(audio|lyrics?|letra|visualizer|live|en vivo|karaoke|cover|traducid[ao]|subtitulos?|subtitulado)\b/;

const ARTIST_CHANNEL_SCORE = 3;
const OFFICIAL_TITLE_SCORE = 2;
const SAME_START_SCORE = 1;
const NOT_A_VIDEO_PENALTY = 2;

/** The artist's own upload labelled as a video ranks highest; fan uploads and audio lowest. */
export function videoScore(video: Track, wantedTitle: string, wantedArtist: string) {
  const title = normalize(video.title);
  let score = 0;

  if (wantedArtist !== '' && video.artists.some((ref) => normalize(ref.name) === wantedArtist)) {
    score += ARTIST_CHANNEL_SCORE;
  }

  if (OFFICIAL_VIDEO.test(title)) {
    score += OFFICIAL_TITLE_SCORE;
  }

  if (title.startsWith(wantedTitle)) {
    score += SAME_START_SCORE;
  }

  if (NOT_A_MUSIC_VIDEO.test(title)) {
    score -= NOT_A_VIDEO_PENALTY;
  }

  return score;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * YT Music does not expose a song's music video to this client, so it is found by search: the
 * first video whose title contains the song title and whose artists include the main artist.
 */
export function findMusicVideo(
  yt: Innertube,
  title: string,
  artist: string,
): Promise<Result<Track | null, MusicError>> {
  return attempt(async () => {
    const results = await yt.music.search(`${title} ${artist}`.trim(), { type: 'video' });
    const wantedTitle = normalize(title);
    const wantedArtist = normalize(artist);
    const videos = toTracks(
      (results.contents ?? []).flatMap((section) => section.contents ?? []),
    ).filter((track) => track.kind === MediaKind.Video);

    const matches = videos.filter(
      (video) =>
        normalize(video.title).includes(wantedTitle) &&
        (wantedArtist === '' ||
          video.artists.some((ref) => normalize(ref.name).includes(wantedArtist)) ||
          normalize(video.title).includes(wantedArtist)),
    );

    // Search order breaks ties, so the best-ranked result wins among equals.
    const scored = matches.map((video, order) => ({
      video,
      order,
      score: videoScore(video, wantedTitle, wantedArtist),
    }));
    scored.sort((a, b) => b.score - a.score || a.order - b.order);

    return scored[0]?.video ?? null;
  });
}
