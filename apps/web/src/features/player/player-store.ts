import { create } from 'zustand';

import type { Track } from '@lyra/shared';

interface PlayerState {
  queue: Track[];
  index: number;
  playTracks: (tracks: Track[], startIndex: number) => void;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  queue: [],
  index: 0,
  playTracks: (tracks, startIndex) => set({ queue: tracks, index: startIndex }),
}));
