// A play counts once this much was heard, or half of a shorter song, as on Last.fm.
export const LISTEN_THRESHOLD_SECONDS = 30;
// Time updates arrive a few times per second; a bigger forward jump is a seek, not listening.
const MAX_TICK_SECONDS = 2;
// Going back to the very start (repeat one, or "previous") begins a new play.
const RESTART_SECONDS = 1;

/** Counts the seconds actually heard of the current song and says when it becomes a listen. */
export class ListenTracker {
  #trackId: string | null = null;
  #heard = 0;
  #lastPosition: number | null = null;
  #isCounted = false;

  #reset(trackId: string) {
    this.#trackId = trackId;
    this.#heard = 0;
    this.#lastPosition = null;
    this.#isCounted = false;
  }

  /** Feeds a position update; true exactly once per play, when it starts to count. */
  update(trackId: string, position: number, duration: number) {
    if (trackId !== this.#trackId) {
      this.#reset(trackId);
    }

    const delta = this.#lastPosition === null ? 0 : position - this.#lastPosition;
    this.#lastPosition = position;

    if (delta < 0 && position < RESTART_SECONDS) {
      this.#reset(trackId);
      this.#lastPosition = position;
    } else if (delta > 0 && delta <= MAX_TICK_SECONDS) {
      this.#heard += delta;
    }

    const threshold =
      duration > 0 ? Math.min(LISTEN_THRESHOLD_SECONDS, duration / 2) : LISTEN_THRESHOLD_SECONDS;

    if (this.#isCounted || this.#heard < threshold) {
      return false;
    }

    this.#isCounted = true;

    return true;
  }
}
