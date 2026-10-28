import { AUDIO_CACHE, IMAGE_CACHE } from '../../offline/keys.ts';
import { offlineDb } from './db.ts';

// Display preferences belong to the device, not to the account.
const KEPT_KEYS = new Set(['lyra.theme', 'lyra.language']);

/** Forgets everything the deleted account left on this device. */
export async function clearLocalData() {
  await Promise.all([
    caches.delete(AUDIO_CACHE).catch(() => false),
    caches.delete(IMAGE_CACHE).catch(() => false),
    offlineDb.delete().catch(() => undefined),
  ]);

  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));

    for (const key of keys) {
      if (key?.startsWith('lyra.') && !KEPT_KEYS.has(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage can be blocked; nothing was saved there then.
  }
}
