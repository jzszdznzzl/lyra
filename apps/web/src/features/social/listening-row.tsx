import { Link } from '@tanstack/react-router';
import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { FriendListening } from '@lyra/shared';

import { formatRelative } from '../../lib/format.ts';
import { Avatar } from '../../ui/avatar.tsx';
import { Cover } from '../../ui/cover.tsx';

/** A friend and the song they are playing now, or heard last. */
export function ListeningRow({ listening }: { listening: FriendListening }) {
  const { t, i18n } = useTranslation();
  const { user, nowPlaying } = listening;
  const { track } = nowPlaying;

  return (
    <li>
      <Link
        to="/track/$id"
        params={{ id: track.id }}
        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface"
      >
        <span className="relative shrink-0">
          <Cover src={track.coverUrl} alt="" className="size-12 rounded-lg" />
          <span className="absolute -right-1.5 -bottom-1.5 rounded-full ring-2 ring-bg">
            <Avatar name={user.name} url={user.avatarUrl} size={22} />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="truncate font-semibold text-text">{user.name}</span>
            {nowPlaying.isPlaying ? (
              <span className="flex shrink-0 items-center gap-1 font-bold text-accent">
                <Radio className="size-3 animate-pulse" />
                {t('social.listeningNow')}
              </span>
            ) : (
              <span className="shrink-0">
                {formatRelative(nowPlaying.updatedAt, i18n.language)}
              </span>
            )}
          </span>
          <span className="block truncate text-[14.5px] font-semibold">{track.title}</span>
          <span className="block truncate text-[13px] text-muted">
            {track.artists.map((artist) => artist.name).join(', ')}
          </span>
        </span>
      </Link>
    </li>
  );
}
