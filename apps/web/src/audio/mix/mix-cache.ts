import { prepareTrack } from './prepare.ts';
import type { PreparedTrack } from './prepare.ts';

// A mix still playing the old song from its object URL needs it a little longer.
const REVOKE_DELAY_MS = 60_000;

/** Songs downloaded and analysed for the mix: the current one and the next. */
export class MixCache {
  #ready = new Map<string, PreparedTrack>();
  #pending = new Map<string, AbortController>();
  // Songs that failed are not tried again for this song pair.
  #failed = new Set<string>();

  get(trackId: string) {
    return this.#ready.get(trackId) ?? null;
  }

  /** Starts preparing a song, unless it is ready, on its way or already failed. */
  request(trackId: string, streamUrl: string) {
    if (this.#ready.has(trackId) || this.#pending.has(trackId) || this.#failed.has(trackId)) {
      return;
    }

    const controller = new AbortController();
    this.#pending.set(trackId, controller);

    prepareTrack(streamUrl, controller.signal)
      .then((prepared) => {
        if (this.#pending.get(trackId) !== controller) {
          if (prepared) {
            URL.revokeObjectURL(prepared.url);
          }

          return;
        }

        this.#pending.delete(trackId);

        if (prepared) {
          this.#ready.set(trackId, prepared);
        } else {
          this.#failed.add(trackId);
        }
      })
      .catch(() => this.#pending.delete(trackId));
  }

  /** Drops every other song, so downloads and memory stay at two songs. */
  keepOnly(trackIds: readonly string[]) {
    const keep = new Set(trackIds);

    for (const [trackId, controller] of this.#pending) {
      if (!keep.has(trackId)) {
        controller.abort();
        this.#pending.delete(trackId);
      }
    }

    for (const [trackId, prepared] of this.#ready) {
      if (!keep.has(trackId)) {
        this.#ready.delete(trackId);
        setTimeout(() => URL.revokeObjectURL(prepared.url), REVOKE_DELAY_MS);
      }
    }

    for (const trackId of this.#failed) {
      if (!keep.has(trackId)) {
        this.#failed.delete(trackId);
      }
    }
  }
}
