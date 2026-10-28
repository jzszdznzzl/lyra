import { useEffect } from 'react';

import { imageUrl } from '../../lib/image.ts';
import { shiftColor, toCss } from '../../lib/palette.ts';
import { useAccent } from '../../lib/use-accent.ts';
import { currentTrack, usePlayerStore } from './player-store.ts';

/** The whole app takes its accent from the cover that is playing. */
export function useCoverTheme() {
  const track = usePlayerStore(currentTrack);
  const accent = useAccent(imageUrl(track?.thumbnail ?? null));

  useEffect(() => {
    const root = document.documentElement.style;

    if (!accent) {
      root.removeProperty('--accent');
      root.removeProperty('--accent-2');

      return;
    }

    root.setProperty('--accent', toCss(accent));
    root.setProperty('--accent-2', toCss(shiftColor(accent)));
  }, [accent]);
}
