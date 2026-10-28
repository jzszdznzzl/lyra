import { Link } from '@tanstack/react-router';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { MediaKind } from '@lyra/shared';
import type { MediaItem, Track } from '@lyra/shared';

import { Cover } from '../../ui/cover.tsx';
import { ArtistLinks } from './artist-links.tsx';
import { isTrack, linkFor } from './links.ts';

interface MediaCardProps {
  item: MediaItem;
  onPlay: (track: Track) => void;
}

export function MediaCard({ item, onPlay }: MediaCardProps) {
  const { t } = useTranslation();
  const isVideo = item.kind === MediaKind.Video;
  const isArtist = item.kind === MediaKind.Artist;
  const cover = (
    <div className="relative">
      <Cover
        src={item.thumbnail}
        alt={item.title}
        isRound={isArtist}
        className={`w-full shadow-xl shadow-black/30 ${isVideo ? 'aspect-video' : 'aspect-square'}`}
      />
      <span className="absolute right-2.5 bottom-2.5 grid size-11 translate-y-2 place-items-center rounded-full bg-accent text-white opacity-0 shadow-lg shadow-accent/40 transition group-hover:translate-y-0 group-hover:opacity-100">
        <Play className="size-5 fill-current" />
      </span>
    </div>
  );
  const subtitle = isTrack(item) ? (
    <ArtistLinks artists={item.artists} />
  ) : (
    item.subtitle || t(`music.${item.kind}`)
  );
  const text = (
    <div className="mt-2.5 min-w-0">
      <p className="line-clamp-2 text-sm font-bold">{item.title}</p>
      <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>
    </div>
  );
  const link = linkFor(item);

  if (link) {
    return (
      <Link {...link} className="group block min-w-0">
        {cover}
        {text}
      </Link>
    );
  }

  return (
    <div className="group min-w-0">
      <button
        type="button"
        className="block w-full text-left"
        aria-label={`${t('music.play')} ${item.title}`}
        onClick={() => {
          if (isTrack(item)) {
            onPlay(item);
          }
        }}
      >
        {cover}
      </button>
      {text}
    </div>
  );
}
