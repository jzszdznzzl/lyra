import { useEffect, useState } from 'react';

import { imageAccent } from './palette.ts';
import type { Rgb } from './palette.ts';

/** Dominant color of the image at `src`, or null while loading or for grey art. */
export function useAccent(src: string | null) {
  const [accent, setAccent] = useState<{ src: string; color: Rgb | null } | null>(null);

  useEffect(() => {
    if (!src) {
      return;
    }

    let isCurrent = true;

    imageAccent(src)
      .then((color) => {
        if (isCurrent) {
          setAccent({ src, color });
        }
      })
      .catch(() => {
        // A missing image just keeps the default accent.
      });

    return () => {
      isCurrent = false;
    };
  }, [src]);

  return accent?.src === src ? accent.color : null;
}
