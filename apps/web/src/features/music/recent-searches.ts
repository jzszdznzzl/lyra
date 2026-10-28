import { create } from 'zustand';
import { z } from 'zod';

const STORAGE_KEY = 'lyra.recent-searches';
const MAX_RECENT = 10;

const RecentList = z.array(z.string()).catch([]);

function read() {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

    return RecentList.parse(stored).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function write(queries: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
  } catch {
    // Storage can be blocked; history then lasts until the tab closes.
  }
}

interface RecentSearchesState {
  queries: string[];
  add: (query: string) => void;
  remove: (query: string) => void;
  clear: () => void;
}

/** Newest first, without duplicates (case-insensitive); kept per device. */
export const useRecentSearches = create<RecentSearchesState>()((set, get) => {
  function save(queries: string[]) {
    set({ queries });
    write(queries);
  }

  return {
    queries: read(),
    add: (query) => {
      const trimmed = query.trim();

      if (trimmed) {
        const others = get().queries.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
        save([trimmed, ...others].slice(0, MAX_RECENT));
      }
    },
    remove: (query) => save(get().queries.filter((item) => item !== query)),
    clear: () => save([]),
  };
});
