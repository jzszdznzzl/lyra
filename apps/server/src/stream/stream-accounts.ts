import { MusicError, err, ok } from '@lyra/shared';
import type { Result } from '@lyra/shared';
import type { Innertube } from 'youtubei.js';

export interface StreamClient {
  yt: Innertube;
  // Resolved URLs are cached under this key: the user's own, or one shared by fallback users.
  cacheKey: string;
  isSignedIn: boolean;
}

export interface ChosenStream<T> {
  client: StreamClient;
  stream: T;
}

// Anonymous requests are retried after this long, in case YouTube lifts the block.
const ANONYMOUS_RETRY_MS = 30 * 60 * 1000;
const FALLBACK_CACHE_KEY = 'stream-fallback';

/**
 * Decides whose session asks YouTube for a song: the user's own Google account when linked,
 * otherwise an anonymous one, and the fallback account once YouTube refuses anonymous requests
 * (its bot check on datacenter IPs).
 */
export class StreamAccounts {
  #now: () => number;
  #loadFallback: () => Promise<Innertube | null>;
  #anonymousBlockedUntil = 0;

  constructor(now: () => number, loadFallback: () => Promise<Innertube | null>) {
    this.#now = now;
    this.#loadFallback = loadFallback;
  }

  async #withFallback<T>(
    resolve: (client: StreamClient) => Promise<Result<T, MusicError>>,
  ): Promise<Result<ChosenStream<T>, MusicError>> {
    const yt = await this.#loadFallback();

    if (!yt) {
      return err(MusicError.GoogleNotLinked);
    }

    const client: StreamClient = { yt, cacheKey: FALLBACK_CACHE_KEY, isSignedIn: true };
    const result = await resolve(client);

    if (result.error === MusicError.GoogleSessionExpired) {
      console.warn('[stream] the fallback Google account must be linked again');

      return err(MusicError.GoogleNotLinked);
    }

    return result.error ? err(result.error) : ok({ client, stream: result.data });
  }

  async resolve<T>(
    own: StreamClient,
    resolve: (client: StreamClient) => Promise<Result<T, MusicError>>,
  ): Promise<Result<ChosenStream<T>, MusicError>> {
    if (!own.isSignedIn && this.#now() < this.#anonymousBlockedUntil) {
      return this.#withFallback(resolve);
    }

    const result = await resolve(own);

    if (result.error !== MusicError.GoogleNotLinked || own.isSignedIn) {
      return result.error ? err(result.error) : ok({ client: own, stream: result.data });
    }

    if (this.#anonymousBlockedUntil === 0) {
      console.warn('[stream] YouTube asks anonymous requests to sign in');
    }

    this.#anonymousBlockedUntil = this.#now() + ANONYMOUS_RETRY_MS;

    return this.#withFallback(resolve);
  }
}
