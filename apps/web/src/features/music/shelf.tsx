import { MediaKind } from '@lyra/shared';
import type { Shelf as ShelfData, Track } from '@lyra/shared';

import { isTrack } from './links.ts';
import { MediaCard } from './media-card.tsx';

interface ShelfProps {
  shelf: ShelfData;
  onPlay: (track: Track, tracks: Track[]) => void;
}

export function Shelf({ shelf, onPlay }: ShelfProps) {
  const tracks = shelf.items.filter(isTrack);
  const hasVideos = shelf.items.some((item) => item.kind === MediaKind.Video);

  return (
    <section className="mt-8">
      <h2 className="mb-3.5 text-[19px] font-bold tracking-tight">{shelf.title}</h2>
      <div className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-7 sm:scroll-px-7 sm:px-7 [scrollbar-width:none]">
        {shelf.items.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            className={`shrink-0 snap-start ${hasVideos ? 'w-64' : 'w-36 sm:w-44'}`}
          >
            <MediaCard item={item} onPlay={(track) => onPlay(track, tracks)} />
          </div>
        ))}
      </div>
    </section>
  );
}
