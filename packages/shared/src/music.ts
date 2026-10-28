import { z } from 'zod';

export const MediaKind = Object.freeze({
  Song: 'song',
  Video: 'video',
  Album: 'album',
  Artist: 'artist',
  Playlist: 'playlist',
} as const);

export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];

export const SearchFilter = Object.freeze({
  All: 'all',
  Songs: 'songs',
  Videos: 'videos',
  Albums: 'albums',
  Artists: 'artists',
  Playlists: 'playlists',
} as const);

export type SearchFilter = (typeof SearchFilter)[keyof typeof SearchFilter];

export const MusicError = Object.freeze({
  NotFound: 'not_found',
  Unavailable: 'unavailable',
  GoogleNotLinked: 'google_not_linked',
  GoogleSessionExpired: 'google_session_expired',
  Upstream: 'upstream',
} as const);

export type MusicError = (typeof MusicError)[keyof typeof MusicError];

export const ArtistRef = z.object({ id: z.string().nullable(), name: z.string() });

export type ArtistRef = z.infer<typeof ArtistRef>;

export const Track = z.object({
  kind: z.enum([MediaKind.Song, MediaKind.Video]),
  id: z.string(),
  title: z.string(),
  artists: z.array(ArtistRef),
  album: z.object({ id: z.string().nullable(), name: z.string() }).nullable(),
  durationSeconds: z.number().nullable(),
  thumbnail: z.string().nullable(),
  isExplicit: z.boolean(),
});

export type Track = z.infer<typeof Track>;

export const AlbumCard = z.object({
  kind: z.literal(MediaKind.Album),
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  thumbnail: z.string().nullable(),
});

export type AlbumCard = z.infer<typeof AlbumCard>;

export const ArtistCard = z.object({
  kind: z.literal(MediaKind.Artist),
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  thumbnail: z.string().nullable(),
});

export type ArtistCard = z.infer<typeof ArtistCard>;

export const PlaylistCard = z.object({
  kind: z.literal(MediaKind.Playlist),
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  thumbnail: z.string().nullable(),
});

export type PlaylistCard = z.infer<typeof PlaylistCard>;

export const MediaItem = z.discriminatedUnion('kind', [Track, AlbumCard, ArtistCard, PlaylistCard]);

export type MediaItem = z.infer<typeof MediaItem>;

export const Shelf = z.object({ title: z.string(), items: z.array(MediaItem) });

export type Shelf = z.infer<typeof Shelf>;

export const HomeFeed = z.object({ shelves: z.array(Shelf) });

export type HomeFeed = z.infer<typeof HomeFeed>;

export const SearchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  filter: z.enum(SearchFilter).default(SearchFilter.All),
});

export type SearchQuery = z.infer<typeof SearchQuery>;

export const SearchResults = z.object({ items: z.array(MediaItem) });

export type SearchResults = z.infer<typeof SearchResults>;

export const SearchSuggestions = z.object({ suggestions: z.array(z.string()) });

export type SearchSuggestions = z.infer<typeof SearchSuggestions>;

export const AlbumPage = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  thumbnail: z.string().nullable(),
  // Playlist that plays the album in order; liking and queueing use it.
  playlistId: z.string().nullable(),
  tracks: z.array(Track),
});

export type AlbumPage = z.infer<typeof AlbumPage>;

export const ArtistPage = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string(),
  thumbnail: z.string().nullable(),
  shelves: z.array(Shelf),
});

export type ArtistPage = z.infer<typeof ArtistPage>;

export const PlaylistPage = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  thumbnail: z.string().nullable(),
  isEditable: z.boolean(),
  tracks: z.array(Track),
});

export type PlaylistPage = z.infer<typeof PlaylistPage>;

export const LibraryPlaylists = z.object({ playlists: z.array(PlaylistCard) });

export type LibraryPlaylists = z.infer<typeof LibraryPlaylists>;

export const AudioQuality = Object.freeze({
  Low: 'low',
  Normal: 'normal',
  High: 'high',
  Max: 'max',
} as const);

export type AudioQuality = (typeof AudioQuality)[keyof typeof AudioQuality];

export const StreamType = Object.freeze({ Audio: 'audio', Video: 'video' } as const);

export type StreamType = (typeof StreamType)[keyof typeof StreamType];

/** Audio file types; Safari on iPhone often cannot play WebM (Opus), only MP4 (AAC). */
export const AudioContainer = Object.freeze({ WebM: 'webm', Mp4: 'mp4' } as const);

export type AudioContainer = (typeof AudioContainer)[keyof typeof AudioContainer];

export const VIDEO_HEIGHTS = [360, 480, 720, 1080] as const;

export type VideoHeight = (typeof VIDEO_HEIGHTS)[number];

export const DEFAULT_VIDEO_HEIGHT: VideoHeight = 720;

export const StreamQuery = z.object({
  type: z.enum(StreamType).default(StreamType.Audio),
  quality: z.enum(AudioQuality).default(AudioQuality.High),
  // Absent means any container the player supports.
  container: z.enum(AudioContainer).optional(),
  height: z.coerce
    .number()
    .pipe(z.union(VIDEO_HEIGHTS.map((height) => z.literal(height))))
    .default(DEFAULT_VIDEO_HEIGHT),
});

export type StreamQuery = z.infer<typeof StreamQuery>;

export const UpNext = z.object({ tracks: z.array(Track) });

export type UpNext = z.infer<typeof UpNext>;

/** Response header with YouTube's loudness measure, so players can even out volume. */
export const LOUDNESS_HEADER = 'x-lyra-loudness-db';

export const PlaylistPrivacy = Object.freeze({
  Private: 'PRIVATE',
  Unlisted: 'UNLISTED',
  Public: 'PUBLIC',
} as const);

export type PlaylistPrivacy = (typeof PlaylistPrivacy)[keyof typeof PlaylistPrivacy];

const VideoId = z.string().regex(/^[\w-]{11}$/);

export const MAX_TRACKS_PER_EDIT = 200;

export const CreatePlaylistInput = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).default(''),
  privacy: z.enum(PlaylistPrivacy).default(PlaylistPrivacy.Private),
  trackIds: z.array(VideoId).max(MAX_TRACKS_PER_EDIT).default([]),
});

export type CreatePlaylistInput = z.infer<typeof CreatePlaylistInput>;

export const RenamePlaylistInput = z.object({ title: z.string().trim().min(1).max(150) });

export type RenamePlaylistInput = z.infer<typeof RenamePlaylistInput>;

export const PlaylistTracksInput = z.object({
  trackIds: z.array(VideoId).min(1).max(MAX_TRACKS_PER_EDIT),
});

export type PlaylistTracksInput = z.infer<typeof PlaylistTracksInput>;

export const PlaylistCreated = z.object({ id: z.string() });

export type PlaylistCreated = z.infer<typeof PlaylistCreated>;

export const VideoForQuery = z.object({
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().max(300).default(''),
});

export type VideoForQuery = z.infer<typeof VideoForQuery>;

export const VideoMatch = z.object({ track: Track.nullable() });

export type VideoMatch = z.infer<typeof VideoMatch>;
