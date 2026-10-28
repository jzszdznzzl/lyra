import { create } from 'zustand';

import { MediaKind } from '@lyra/shared';

import { currentTrack, usePlayerStore } from './player-store.ts';

export const PanelView = Object.freeze({
  Cover: 'cover',
  Lyrics: 'lyrics',
  Queue: 'queue',
} as const);

export type PanelView = (typeof PanelView)[keyof typeof PanelView];

export const ImmersiveMode = Object.freeze({
  Video: 'video',
  Lyrics: 'lyrics',
  Player: 'player',
} as const);

export type ImmersiveMode = (typeof ImmersiveMode)[keyof typeof ImmersiveMode];

interface UiState {
  // What the now-playing panel (desktop) or full-screen player (mobile) shows.
  panelView: PanelView;
  immersive: ImmersiveMode | null;
  setPanelView: (view: PanelView) => void;
  openImmersive: () => void;
  closeImmersive: () => void;
}

/** Full screen shows what the user was looking at: the video, the lyrics, or else the player. */
function pickImmersiveMode(panelView: PanelView): ImmersiveMode {
  const player = usePlayerStore.getState();

  if (player.isVideoMode && currentTrack(player)?.kind === MediaKind.Video) {
    return ImmersiveMode.Video;
  }

  return panelView === PanelView.Lyrics ? ImmersiveMode.Lyrics : ImmersiveMode.Player;
}

export const useUiStore = create<UiState>()((set, get) => ({
  panelView: PanelView.Cover,
  immersive: null,
  setPanelView: (panelView) => set({ panelView }),
  openImmersive: () => {
    if (currentTrack(usePlayerStore.getState())) {
      set({ immersive: pickImmersiveMode(get().panelView) });
    }
  },
  closeImmersive: () => set({ immersive: null }),
}));
