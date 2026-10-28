import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { libraryPlaylistsQuery } from '../features/music/api.ts';
import { Cover } from '../ui/cover.tsx';

export function LibrarySidebar({ isGoogleLinked }: { isGoogleLinked: boolean }) {
  const { t } = useTranslation();
  const playlists = useQuery({ ...libraryPlaylistsQuery, enabled: isGoogleLinked });

  if (!isGoogleLinked) {
    return (
      <Link to="/profile" className="px-3 text-[13px] text-muted hover:text-text">
        {t('music.linkToSeeLibrary')}
      </Link>
    );
  }

  return (
    <div className="-mx-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1">
      <Link
        to="/liked"
        className="flex items-center gap-2.5 rounded-xl p-1.5 text-[13px] hover:bg-surface data-[status=active]:bg-surface-2"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-300">
          <Heart className="size-4 fill-white text-white" />
        </span>
        <span className="truncate font-semibold">{t('music.likedSongs')}</span>
      </Link>
      {playlists.data?.playlists
        .filter((playlist) => playlist.id !== 'LM' && playlist.id !== 'VLLM')
        .map((playlist) => (
          <Link
            key={playlist.id}
            to="/playlist/$id"
            params={{ id: playlist.id }}
            className="flex items-center gap-2.5 rounded-xl p-1.5 text-[13px] hover:bg-surface data-[status=active]:bg-surface-2"
          >
            <Cover src={playlist.thumbnail} alt="" className="size-10 shrink-0 rounded-lg" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{playlist.title}</span>
              <span className="block truncate text-[11.5px] text-muted">{playlist.subtitle}</span>
            </span>
          </Link>
        ))}
    </div>
  );
}
