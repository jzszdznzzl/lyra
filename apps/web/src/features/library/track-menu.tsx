import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  CircleMinus,
  Disc3,
  Download,
  FolderInput,
  FolderMinus,
  Heart,
  ListEnd,
  ListPlus,
  ListStart,
  MoreHorizontal,
  Share2,
  Trash2,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Track } from '@lyra/shared';

import { Menu } from '../../ui/menu.tsx';
import type { MenuItem } from '../../ui/menu.tsx';
import { meQuery } from '../auth/api.ts';
import { useDownloads } from '../offline/downloads.ts';
import { AddToFolderDialog } from '../offline/folder-dialogs.tsx';
import { useFolders } from '../offline/folders.ts';
import { useShare } from '../share/share-button.tsx';
import { ShareKind } from '../share/share.ts';
import { usePlayerStore } from '../player/player-store.ts';
import { removeFromPlaylist } from './api.ts';
import { AddToPlaylistDialog } from './playlist-dialogs.tsx';
import { useLikes } from './use-likes.ts';

export interface PlaylistContext {
  id: string;
  isEditable: boolean;
}

interface TrackMenuProps {
  track: Track;
  playlist?: PlaylistContext | undefined;
  // Set inside a folder of downloads, so the song can be taken out of it.
  folderId?: string | undefined;
}

export function TrackMenu({ track, playlist, folderId }: TrackMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const { canLike, isLiked, toggle } = useLikes();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const { playNext, addToQueue } = usePlayerStore.getState();
  const hasLibrary = me?.isGoogleLinked ?? false;
  const isDownloaded = useDownloads((state) => state.records.has(track.id));
  const share = useShare();
  const albumId = track.album?.id ?? null;
  const artistId = track.artists.find((artist) => artist.id)?.id ?? null;

  const items: MenuItem[] = [
    {
      label: t('library.playNext'),
      icon: <ListStart className="size-4" />,
      onSelect: () => playNext([track]),
    },
    {
      label: t('library.addToQueue'),
      icon: <ListEnd className="size-4" />,
      onSelect: () => addToQueue([track]),
    },
  ];

  items.push(
    isDownloaded
      ? {
          label: t('offline.removeDownload'),
          icon: <CircleMinus className="size-4" />,
          onSelect: () => void useDownloads.getState().remove([track.id]),
        }
      : {
          label: t('offline.download'),
          icon: <Download className="size-4" />,
          onSelect: () =>
            useDownloads.getState().download([track], usePlayerStore.getState().settings.quality),
        },
  );

  if (isDownloaded) {
    items.push({
      label: t('folders.addTo'),
      icon: <FolderInput className="size-4" />,
      onSelect: () => setIsPickingFolder(true),
    });
  }

  if (folderId) {
    items.push({
      label: t('folders.removeFrom'),
      icon: <FolderMinus className="size-4" />,
      onSelect: () => void useFolders.getState().removeTracks(folderId, [track.id]),
    });
  }

  if (hasLibrary) {
    items.push({
      label: t('library.addToPlaylist'),
      icon: <ListPlus className="size-4" />,
      onSelect: () => setIsPicking(true),
    });
  }

  if (canLike) {
    items.push({
      label: isLiked(track.id) ? t('library.unlike') : t('library.like'),
      icon: <Heart className="size-4" />,
      onSelect: () => void toggle(track),
    });
  }

  if (playlist?.isEditable) {
    items.push({
      label: t('library.removeFromPlaylist'),
      icon: <Trash2 className="size-4" />,
      isDanger: true,
      onSelect: () => {
        void removeFromPlaylist(playlist.id, [track.id]).then(() =>
          queryClient.invalidateQueries({ queryKey: ['music', 'playlist', playlist.id] }),
        );
      },
    });
  }

  items.push({
    label: t('share.action'),
    icon: <Share2 className="size-4" />,
    onSelect: () => void share(ShareKind.Track, track.id, track.title),
  });

  if (albumId) {
    items.push({
      label: t('library.goToAlbum'),
      icon: <Disc3 className="size-4" />,
      onSelect: () => void navigate({ to: '/album/$id', params: { id: albumId } }),
    });
  }

  if (artistId) {
    items.push({
      label: t('library.goToArtist'),
      icon: <User className="size-4" />,
      onSelect: () => void navigate({ to: '/artist/$id', params: { id: artistId } }),
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('library.more')}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setAnchor(anchor ? null : event.currentTarget);
        }}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
      >
        <MoreHorizontal className="size-[18px]" />
      </button>
      {anchor ? <Menu anchor={anchor} items={items} onClose={() => setAnchor(null)} /> : null}
      {isPicking ? (
        <AddToPlaylistDialog tracks={[track]} onClose={() => setIsPicking(false)} />
      ) : null}
      {isPickingFolder ? (
        <AddToFolderDialog trackIds={[track.id]} onClose={() => setIsPickingFolder(false)} />
      ) : null}
    </>
  );
}
