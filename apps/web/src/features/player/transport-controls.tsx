import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { RepeatMode } from '../../audio/queue.ts';
import { PlaybackStatus, usePlayerStore } from './player-store.ts';

export function TransportControls({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { t } = useTranslation();
  const status = usePlayerStore((state) => state.status);
  const repeat = usePlayerStore((state) => state.repeat);
  const isShuffled = usePlayerStore((state) => state.isShuffled);
  const { togglePlay, next, previous, toggleShuffle, cycleRepeat } = usePlayerStore.getState();
  const isPlaying = status === PlaybackStatus.Playing;
  const isLoading = status === PlaybackStatus.Loading;
  const isLarge = size === 'lg';
  const RepeatIcon = repeat === RepeatMode.One ? Repeat1 : Repeat;
  const repeatLabel = {
    [RepeatMode.Off]: t('player.repeatOff'),
    [RepeatMode.All]: t('player.repeatAll'),
    [RepeatMode.One]: t('player.repeatOne'),
  }[repeat];

  return (
    <div className={`flex items-center ${isLarge ? 'w-full justify-between' : 'gap-5'}`}>
      <button
        type="button"
        aria-label={t('player.shuffle')}
        aria-pressed={isShuffled}
        onClick={toggleShuffle}
        className="text-muted transition hover:text-text aria-pressed:text-accent"
      >
        <Shuffle className={isLarge ? 'size-5' : 'size-4'} />
      </button>
      <button
        type="button"
        aria-label={t('player.previous')}
        onClick={previous}
        className="transition hover:scale-105"
      >
        <SkipBack className={`fill-current ${isLarge ? 'size-7' : 'size-5'}`} />
      </button>
      <button
        type="button"
        aria-label={isPlaying ? t('player.pause') : t('player.play')}
        onClick={togglePlay}
        className={`grid place-items-center rounded-full bg-text text-bg transition hover:scale-105 ${isLarge ? 'size-[70px]' : 'size-11'}`}
      >
        {isLoading ? (
          <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : isPlaying ? (
          <Pause className={`fill-current ${isLarge ? 'size-7' : 'size-5'}`} />
        ) : (
          <Play className={`translate-x-px fill-current ${isLarge ? 'size-7' : 'size-5'}`} />
        )}
      </button>
      <button
        type="button"
        aria-label={t('player.next')}
        onClick={next}
        className="transition hover:scale-105"
      >
        <SkipForward className={`fill-current ${isLarge ? 'size-7' : 'size-5'}`} />
      </button>
      <button
        type="button"
        aria-label={repeatLabel}
        title={repeatLabel}
        aria-pressed={repeat !== RepeatMode.Off}
        onClick={cycleRepeat}
        className="text-muted transition hover:text-text aria-pressed:text-accent"
      >
        <RepeatIcon className={isLarge ? 'size-5' : 'size-4'} />
      </button>
    </div>
  );
}
