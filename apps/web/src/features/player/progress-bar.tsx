import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDuration } from '../../lib/format.ts';
import { usePlayerStore } from './player-store.ts';

/** How far into the song, 0–100, never past the ends even if the position overshoots. */
export function progressPercent(position: number, duration: number) {
  return duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
}

export function ProgressBar({ isCompact = false }: { isCompact?: boolean }) {
  const { t } = useTranslation();
  const position = usePlayerStore((state) => state.position);
  const duration = usePlayerStore((state) => state.duration);
  const crossfade = usePlayerStore((state) => state.settings.crossfadeSeconds);
  const seek = usePlayerStore((state) => state.seek);
  // While dragging, the thumb follows the finger instead of the audio.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const shown = dragValue ?? position;
  const percent = progressPercent(shown, duration);
  const crossfadePercent = duration > 0 ? Math.min(100, (crossfade / duration) * 100) : 0;

  return (
    <div
      className={`flex w-full items-center gap-2.5 text-[11.5px] text-muted tabular-nums ${isCompact ? '' : 'max-w-xl'}`}
    >
      {isCompact ? null : <span className="w-10 text-right">{formatDuration(shown)}</span>}
      <div className="group relative flex h-4 flex-1 items-center">
        <div className="relative h-1 w-full rounded-full bg-text/15">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-2 to-accent"
            style={{ width: `${percent}%` }}
          />
          {crossfadePercent > 0 ? (
            <div
              className="absolute -inset-y-px right-0 rounded-full bg-[repeating-linear-gradient(90deg,var(--accent-2)_0_2px,transparent_2px_4px)] opacity-60"
              style={{ width: `${crossfadePercent}%` }}
            />
          ) : null}
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text opacity-0 shadow transition group-hover:opacity-100"
            style={{ left: `${percent}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.5}
          value={shown}
          aria-label={t('player.seek')}
          onChange={(event) => setDragValue(Number(event.target.value))}
          onPointerUp={() => {
            if (dragValue !== null) {
              seek(dragValue);
              setDragValue(null);
            }
          }}
          onKeyUp={() => {
            if (dragValue !== null) {
              seek(dragValue);
              setDragValue(null);
            }
          }}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        />
      </div>
      {isCompact ? null : <span className="w-10">{formatDuration(duration)}</span>}
    </div>
  );
}
