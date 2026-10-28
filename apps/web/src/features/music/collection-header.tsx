import { Play, Shuffle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Track } from '@lyra/shared';

import { imageUrl } from '../../lib/image.ts';
import { toCss } from '../../lib/palette.ts';
import { useAccent } from '../../lib/use-accent.ts';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Cover } from '../../ui/cover.tsx';
import { usePlayerStore } from '../player/player-store.ts';

interface CollectionHeaderProps {
  kind: string;
  title: string;
  subtitle: string;
  thumbnail: string | null;
  tracks: Track[];
  isRound?: boolean;
  actions?: ReactNode;
}

export function CollectionHeader({
  kind,
  title,
  subtitle,
  thumbnail,
  tracks,
  isRound = false,
  actions,
}: CollectionHeaderProps) {
  const { t } = useTranslation();
  const playTracks = usePlayerStore((state) => state.playTracks);
  const accent = useAccent(imageUrl(thumbnail));

  function shuffle() {
    const shuffled = [...tracks];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      const current = shuffled[index];
      const swap = shuffled[other];

      if (current && swap) {
        shuffled[index] = swap;
        shuffled[other] = current;
      }
    }

    playTracks(shuffled, 0);
  }

  return (
    <header
      className="-mx-4 -mt-4 flex flex-col items-center gap-6 px-4 pt-8 pb-6 sm:-mx-7 sm:flex-row sm:items-end sm:px-7"
      style={
        accent
          ? { background: `linear-gradient(180deg, ${toCss(accent)} -40%, transparent 100%)` }
          : undefined
      }
    >
      <Cover
        src={thumbnail}
        alt={title}
        isRound={isRound}
        className="size-48 shrink-0 shadow-2xl shadow-black/40 sm:size-56"
      />
      <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
        <span className="text-xs font-bold tracking-[0.12em] text-muted uppercase">{kind}</span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-sm text-muted">{subtitle}</p>
        {tracks.length > 0 || actions ? (
          <div className="mt-3 flex items-center gap-3">
            {tracks.length > 0 ? (
              <>
                <Button onClick={() => playTracks(tracks, 0)}>
                  <Play className="size-4 fill-current" />
                  {t('music.play')}
                </Button>
                <Button variant={ButtonVariant.Secondary} onClick={shuffle}>
                  <Shuffle className="size-4" />
                  {t('music.shuffle')}
                </Button>
              </>
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
