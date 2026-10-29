import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Heart, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Cover } from '../../ui/cover.tsx';
import { libraryPlaylistsQuery } from '../music/api.ts';

// With Liked songs and History, six tiles fill both the two- and three-column grid.
const MAX_TILES = 4;
const TILE_CLASS =
  'flex h-14 items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface pr-3 text-[13.5px] font-bold transition hover:bg-surface-2 sm:h-16';

/** The mockup's top grid: Liked songs and the user's playlists, one tap away. */
export function QuickAccess() {
  const { t } = useTranslation();
  const playlists = useQuery(libraryPlaylistsQuery);

  return (
    <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      <Link to="/liked" className={TILE_CLASS}>
        <span className="grid h-full aspect-square place-items-center bg-gradient-to-br from-indigo-600 to-violet-300">
          <Heart className="size-5 fill-white text-white" />
        </span>
        <span className="truncate">{t('music.likedSongs')}</span>
      </Link>
      <Link to="/history" className={TILE_CLASS}>
        <span className="grid h-full aspect-square place-items-center bg-surface-2">
          <History className="size-5 text-text" />
        </span>
        <span className="truncate">{t('music.history.title')}</span>
      </Link>
      {playlists.data?.playlists.slice(0, MAX_TILES).map((playlist) => (
        <Link
          key={playlist.id}
          to="/playlist/$id"
          params={{ id: playlist.id }}
          className={TILE_CLASS}
        >
          <Cover
            src={playlist.thumbnail}
            alt=""
            className="h-full aspect-square shrink-0 rounded-none"
          />
          <span className="truncate">{playlist.title}</span>
        </Link>
      ))}
    </div>
  );
}
