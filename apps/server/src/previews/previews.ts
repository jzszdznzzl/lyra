import { getAlbum, getArtist, getPlaylist, getTrack } from '../ytmusic/catalog.ts';
import type { ImageRegistry } from '../images/registry.ts';
import type { InnertubePool } from '../ytmusic/innertube.ts';
import { DEFAULT_PREVIEW, PreviewType } from './head.ts';
import type { Preview } from './head.ts';

const ROUTES: [RegExp, PreviewType][] = [
  [/^\/track\/([\w-]{11})$/, PreviewType.Song],
  [/^\/album\/([\w-]{2,64})$/, PreviewType.Album],
  [/^\/playlist\/([\w-]{2,64})$/, PreviewType.Playlist],
  [/^\/artist\/([\w-]{2,64})$/, PreviewType.Profile],
];
const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_LIMIT = 1000;

interface Cached {
  preview: Preview;
  expiresAt: number;
}

/**
 * Titles and covers for shared links. Uses an anonymous YT Music client: link previews are
 * fetched by WhatsApp or Telegram without a session, so only public data can appear.
 */
export class LinkPreviews {
  #pool: InnertubePool;
  #images: ImageRegistry;
  #now: () => number;
  #cache = new Map<string, Cached>();

  constructor(pool: InnertubePool, images: ImageRegistry, now: () => number) {
    this.#pool = pool;
    this.#images = images;
    this.#now = now;
  }

  async #load(type: PreviewType, id: string): Promise<Preview | null> {
    const yt = await this.#pool.get({ userId: null, cookie: null, language: 'en' });

    switch (type) {
      case PreviewType.Song: {
        const track = await getTrack(yt, id);

        return track.data
          ? {
              type,
              title: track.data.title,
              description: track.data.artists.map((artist) => artist.name).join(', '),
              image: track.data.thumbnail ?? '',
            }
          : null;
      }
      case PreviewType.Album: {
        const album = await getAlbum(yt, id);

        return album.data
          ? {
              type,
              title: album.data.title,
              description: album.data.subtitle,
              image: album.data.thumbnail ?? '',
            }
          : null;
      }
      case PreviewType.Playlist: {
        const playlist = await getPlaylist(yt, id);

        return playlist.data
          ? {
              type,
              title: playlist.data.title,
              description: playlist.data.subtitle,
              image: playlist.data.thumbnail ?? '',
            }
          : null;
      }
      case PreviewType.Profile: {
        const artist = await getArtist(yt, id);

        return artist.data
          ? {
              type,
              title: artist.data.name,
              description: artist.data.subtitle,
              image: artist.data.thumbnail ?? '',
            }
          : null;
      }
      default: {
        return null;
      }
    }
  }

  async forPath(pathname: string): Promise<Preview> {
    const route = ROUTES.map(([pattern, type]) => ({ match: pattern.exec(pathname), type })).find(
      ({ match }) => match,
    );
    const id = route?.match?.[1];

    if (!route || !id) {
      return DEFAULT_PREVIEW;
    }

    const cached = this.#cache.get(pathname);

    if (cached && cached.expiresAt > this.#now()) {
      return cached.preview;
    }

    const loaded = await this.#load(route.type, id).catch(() => null);
    let preview = DEFAULT_PREVIEW;

    if (loaded) {
      // The registry swaps the cover URL for an /api/images id, so lyra serves the card image.
      const cover = { thumbnail: loaded.image || null };
      await this.#images.rewrite(cover);
      preview = { ...loaded, image: cover.thumbnail ?? DEFAULT_PREVIEW.image };
    }

    if (this.#cache.size >= CACHE_LIMIT) {
      this.#cache.clear();
    }

    this.#cache.set(pathname, { preview, expiresAt: this.#now() + CACHE_MS });

    return preview;
  }
}
