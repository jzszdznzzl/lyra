import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Track } from '@lyra/shared';

import { formatDuration } from '../../lib/format.ts';
import { Cover } from '../../ui/cover.tsx';
import { usePlayerStore } from '../player/player-store.ts';
import { ArtistLinks } from './artist-links.tsx';

interface TrackListProps {
  tracks: Track[];
  showCovers?: boolean;
  showIndex?: boolean;
}

export function TrackList({ tracks, showCovers = true, showIndex = false }: TrackListProps) {
  const { t } = useTranslation();
  const playTracks = usePlayerStore((state) => state.playTracks);
  const currentId = usePlayerStore((state) => state.queue[state.index]?.id);

  return (
    <ol className="flex flex-col">
      {tracks.map((track, index) => {
        const isCurrent = track.id === currentId;

        return (
          <li key={`${track.id}-${index}`}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => playTracks(tracks, index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  playTracks(tracks, index);
                }
              }}
              className="group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface sm:grid-cols-[auto_1fr_1fr_auto]"
            >
              <div className="relative grid size-11 place-items-center">
                {showCovers ? (
                  <Cover src={track.thumbnail} alt="" className="size-11 rounded-lg" />
                ) : showIndex ? (
                  <span className="text-sm text-muted tabular-nums group-hover:opacity-0">
                    {index + 1}
                  </span>
                ) : null}
                <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/50 opacity-0 group-hover:opacity-100">
                  <Play className="size-4 fill-white text-white" />
                </span>
              </div>
              <div className="min-w-0">
                <p
                  className={`truncate text-[14.5px] font-semibold ${isCurrent ? 'text-accent' : ''}`}
                >
                  {track.title}
                </p>
                <p className="truncate text-[13px] text-muted">
                  {track.isExplicit ? (
                    <span
                      title={t('music.explicit')}
                      className="mr-1.5 inline-grid size-4 place-items-center rounded-sm bg-muted/30 text-[10px] font-bold text-text"
                    >
                      E
                    </span>
                  ) : null}
                  <ArtistLinks artists={track.artists} />
                </p>
              </div>
              <p className="hidden truncate text-[13px] text-muted sm:block">{track.album?.name}</p>
              <span className="text-[13px] text-muted tabular-nums">
                {track.durationSeconds === null ? '' : formatDuration(track.durationSeconds)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
