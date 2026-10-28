import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Track } from '@lyra/shared';

import { useLikes } from './use-likes.ts';

export function LikeButton({ track, size = 'md' }: { track: Track; size?: 'md' | 'lg' }) {
  const { t } = useTranslation();
  const { canLike, isLiked, toggle } = useLikes();

  if (!canLike) {
    return null;
  }

  const isOn = isLiked(track.id);

  return (
    <button
      type="button"
      aria-label={isOn ? t('library.unlike') : t('library.like')}
      aria-pressed={isOn}
      onClick={(event) => {
        event.stopPropagation();
        void toggle(track);
      }}
      className="shrink-0 text-muted transition hover:scale-110 hover:text-text aria-pressed:text-accent"
    >
      <Heart
        className={`${size === 'lg' ? 'size-7' : 'size-[18px]'} ${isOn ? 'fill-current' : ''}`}
      />
    </button>
  );
}
