import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { usePlayerStore } from './player-store.ts';

const DEFAULT_RESTORE = 0.6;

export function VolumeControl() {
  const { t } = useTranslation();
  const volume = usePlayerStore((state) => state.settings.volume);
  const updateSettings = usePlayerStore((state) => state.updateSettings);
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
            updateSettings({ volume: 0 });
          } else {
            updateSettings({ volume: beforeMute.current });
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
        onChange={(event) => updateSettings({ volume: Number(event.target.value) })}
        className="h-1 w-24 cursor-pointer accent-[var(--text)]"
      />
    </div>
  );
}
