import { IMAGE_HOSTS, IMAGE_PATH } from '../images/registry.ts';
import type { ImageRegistry } from '../images/registry.ts';

// Twice the card's 72px slot, so it stays sharp on high-density screens.
const COVER_PIXELS = 144;
const FETCH_TIMEOUT_MS = 3000;
const MAX_COVER_BYTES = 512 * 1024;
const CACHE_LIMIT = 200;
// Google's image CDN picks the size from the URL, e.g. "=w544-h544-l90-rj".
const GOOGLE_SIZE = /=w\d+-h\d+/;

/**
 * Covers for the widget, inlined as data: URIs. Only lyra image ids are accepted, so a cover
 * URL sent by a client can never make the server fetch an arbitrary address.
 */
export class WidgetCovers {
  #images: ImageRegistry;
  #prefix: string;
  #cache = new Map<string, string>();

  constructor(images: ImageRegistry, publicOrigin: string) {
    this.#images = images;
    this.#prefix = `${publicOrigin}${IMAGE_PATH}`;
  }

  async #download(id: string) {
    const remote = await this.#images.urlOf(id);

    if (!remote || !IMAGE_HOSTS.has(new URL(remote).hostname)) {
      return null;
    }

    const url = remote.replace(GOOGLE_SIZE, `=w${COVER_PIXELS}-h${COVER_PIXELS}`);
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).catch(() => null);
    const type = response?.headers.get('content-type') ?? '';

    if (!response?.ok || !type.startsWith('image/')) {
      return null;
    }

    const bytes = await response.arrayBuffer().catch(() => null);

    if (!bytes || bytes.byteLength > MAX_COVER_BYTES) {
      return null;
    }

    return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
  }

  async dataUri(coverUrl: string | null): Promise<string | null> {
    if (!coverUrl?.startsWith(this.#prefix)) {
      return null;
    }

    const id = coverUrl.slice(this.#prefix.length);
    const cached = this.#cache.get(id);

    if (cached !== undefined) {
      return cached;
    }

    const uri = await this.#download(id);

    // Failures are not kept: a slow CDN once should not leave the card without a cover.
    if (uri) {
      if (this.#cache.size >= CACHE_LIMIT) {
        this.#cache.clear();
      }

      this.#cache.set(id, uri);
    }

    return uri;
  }
}
