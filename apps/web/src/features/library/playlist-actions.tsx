import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Menu } from '../../ui/menu.tsx';
import { libraryPlaylistsQuery } from '../music/api.ts';
import { deletePlaylist } from './api.ts';
import { RenamePlaylistDialog } from './playlist-dialogs.tsx';

export function PlaylistActions({ id, title }: { id: string; title: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  async function remove() {
    if (!window.confirm(t('library.deleteConfirm', { title }))) {
      return;
    }

    const result = await deletePlaylist(id);

    if (!result.error) {
      await queryClient.invalidateQueries({ queryKey: libraryPlaylistsQuery.queryKey });
      await navigate({ to: '/' });
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('library.more')}
        aria-haspopup="menu"
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
        className="grid size-11 place-items-center rounded-full border border-line text-muted hover:text-text"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {anchor ? (
        <Menu
          anchor={anchor}
          onClose={() => setAnchor(null)}
          items={[
            {
              label: t('library.rename'),
              icon: <Pencil className="size-4" />,
              onSelect: () => setIsRenaming(true),
            },
            {
              label: t('library.delete'),
              icon: <Trash2 className="size-4" />,
              isDanger: true,
              onSelect: () => void remove(),
            },
          ]}
        />
      ) : null}
      {isRenaming ? (
        <RenamePlaylistDialog id={id} current={title} onClose={() => setIsRenaming(false)} />
      ) : null}
    </>
  );
}
