import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { usePlayerStore } from './player-store.ts';

const DEFAULT_RESTORE = 0.6;

export function VolumeControl() {
  const { t } = useTranslation();
  // While another device plays, this slider is that device's volume.
  const volume = usePlayerStore((state) => state.remote?.volume ?? state.settings.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const beforeMute = useRef(DEFAULT_RESTORE);
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={t('player.mute')}
        onClick={() => {
          if (volume > 0) {
            beforeMute.current = volume;
            setVolume(0);
          } else {
            setVolume(beforeMute.current);
          }
        }}
        className="text-muted hover:text-text"
      >
        <Icon className="size-[18px]" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        aria-label={t('player.volume')}
        onChange={(event) => setVolume(Number(event.target.value))}
        className="h-1 w-24 cursor-pointer accent-[var(--text)]"
      />
    </div>
  );
}
