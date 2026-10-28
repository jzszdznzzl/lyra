import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Cover } from '../../ui/cover.tsx';
import { usePlayerStore } from './player-store.ts';

export function QueuePanel() {
  const { t } = useTranslation();
  const queue = usePlayerStore((state) => state.queue);
  const index = usePlayerStore((state) => state.index);
  const { jumpTo, removeFromQueue, moveInQueue } = usePlayerStore.getState();
  const upcoming = queue.map((track, position) => ({ track, position })).slice(index + 1);

  return (
    <div className="flex min-h-0 flex-col gap-1">
      <p className="text-xs tracking-[0.12em] text-muted uppercase">{t('player.nextUp')}</p>
      {upcoming.length === 0 ? (
        <p className="py-3 text-sm text-muted">{t('player.emptyQueue')}</p>
      ) : null}
      <ol className="flex flex-col">
        {upcoming.map(({ track, position }) => (
          <li
            key={`${track.id}-${position}`}
            className="group flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-surface"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              onClick={() => jumpTo(position)}
            >
              <Cover src={track.thumbnail} alt="" className="size-10 shrink-0 rounded-md" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{track.title}</span>
                <span className="block truncate text-[11.5px] text-muted">
                  {track.artists.map((artist) => artist.name).join(', ')}
                </span>
              </span>
            </button>
            <span className="flex shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <button
                type="button"
                aria-label={t('player.moveUp')}
                disabled={position === index + 1}
                onClick={() => moveInQueue(position, position - 1)}
                className="p-1 text-muted hover:text-text disabled:opacity-30"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t('player.moveDown')}
                disabled={position === queue.length - 1}
                onClick={() => moveInQueue(position, position + 1)}
                className="p-1 text-muted hover:text-text disabled:opacity-30"
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t('player.remove')}
                onClick={() => removeFromQueue(position)}
                className="p-1 text-muted hover:text-red-400"
              >
                <X className="size-4" />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
