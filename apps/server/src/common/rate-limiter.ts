interface Window {
  count: number;
  resetAt: number;
}

/** Fixed-window counter kept in memory; enough for one process serving one person. */
export class RateLimiter {
  #windows = new Map<string, Window>();
  #limit: number;
  #windowMs: number;
  #now: () => number;

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
  }

  /** Counts one hit for `key`; returns false once the limit is exceeded in the current window. */
  hit(key: string) {
    const now = this.#now();
    const current = this.#windows.get(key);

    if (!current || current.resetAt <= now) {
      this.#windows.set(key, { count: 1, resetAt: now + this.#windowMs });
      this.#prune(now);

      return true;
    }

    current.count += 1;

    return current.count <= this.#limit;
  }

  #prune(now: number) {
    for (const [key, window] of this.#windows) {
      if (window.resetAt <= now) {
        this.#windows.delete(key);
      }
    }
  }
}
