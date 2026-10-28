import { z } from 'zod';

const STORAGE_KEY = 'lyra.dismissedAnnouncements';
// Ids of long-gone announcements are useless; a short list is plenty.
const MAX_REMEMBERED = 50;

export function readDismissed(): string[] {
  try {
    const parsed = z
      .array(z.string())
      .safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));

    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function rememberDismissed(id: string) {
  const ids = [id, ...readDismissed().filter((known) => known !== id)].slice(0, MAX_REMEMBERED);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be blocked; the banner then simply stays hidden until the page reloads.
  }

  return ids;
}
