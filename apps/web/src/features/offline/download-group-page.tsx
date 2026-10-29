import { useNavigate, useParams } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Page } from '../../ui/page.tsx';
import { CollectionHeader } from '../music/collection-header.tsx';
import { TrackList } from '../music/track-list.tsx';
import { DownloadGroupKind, groupByAlbum, groupByArtist } from './download-groups.ts';
import { DownloadsView } from './downloads-page.tsx';
import { useDownloads } from './downloads.ts';
import { FolderNameDialog } from './folder-dialogs.tsx';
import { useFolders } from './folders.ts';

const ROUTES = {
  [DownloadGroupKind.Folder]: '/app/downloads/folder/$id',
  [DownloadGroupKind.Album]: '/app/downloads/album/$id',
  [DownloadGroupKind.Artist]: '/app/downloads/artist/$id',
} as const satisfies Record<DownloadGroupKind, string>;

const KIND_LABELS = {
  [DownloadGroupKind.Folder]: 'folders.folder',
  [DownloadGroupKind.Album]: 'music.album',
  [DownloadGroupKind.Artist]: 'music.artist',
} as const satisfies Record<DownloadGroupKind, string>;

/** Downloaded songs of one folder, album or artist. */
export function DownloadGroupPage({ kind }: { kind: DownloadGroupKind }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams({ from: ROUTES[kind] });
  const records = useDownloads((state) => state.records);
  const folder = useFolders((state) => state.folders.get(id));
  const [isRenaming, setIsRenaming] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const group = useMemo(() => {
    const tracks = [...records.values()]
      .sort((a, b) => b.downloadedAt - a.downloadedAt)
      .map((record) => record.track);

    if (kind === DownloadGroupKind.Folder) {
      return folder
        ? {
            name: folder.name,
            tracks: folder.trackIds.flatMap((trackId) => {
              const record = records.get(trackId);

              return record ? [record.track] : [];
            }),
          }
        : null;
    }

    const groups = kind === DownloadGroupKind.Album ? groupByAlbum(tracks) : groupByArtist(tracks);

    return groups.find((candidate) => candidate.key === id) ?? null;
  }, [kind, id, records, folder]);

  useDocumentTitle(group?.name ?? t('offline.title'));

  if (!group) {
    return (
      <Page>
        <p className="text-sm text-muted">{t('folders.notFound')}</p>
      </Page>
    );
  }

  return (
    <Page>
      <CollectionHeader
        kind={t(KIND_LABELS[kind])}
        title={group.name}
        subtitle={t('music.songs', { count: group.tracks.length })}
        thumbnail={group.tracks[0]?.thumbnail ?? null}
        isRound={kind === DownloadGroupKind.Artist}
        tracks={group.tracks}
        actions={
          kind === DownloadGroupKind.Folder ? (
            <>
              <Button variant={ButtonVariant.Ghost} onClick={() => setIsRenaming(true)}>
                <Pencil className="size-4" />
                {t('folders.rename')}
              </Button>
              <Button variant={ButtonVariant.Ghost} onClick={() => setIsConfirmingDelete(true)}>
                <Trash2 className="size-4" />
                {t('folders.delete')}
              </Button>
            </>
          ) : null
        }
      />
      {isConfirmingDelete ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4 sm:flex-row sm:items-center"
        >
          <p className="flex-1 text-sm">{t('folders.deleteConfirm', { name: group.name })}</p>
          <div className="flex justify-end gap-2">
            <Button variant={ButtonVariant.Ghost} onClick={() => setIsConfirmingDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={ButtonVariant.Danger}
              onClick={() => {
                void useFolders.getState().remove(id);
                void navigate({ to: '/downloads', search: { view: DownloadsView.Folders } });
              }}
            >
              {t('folders.delete')}
            </Button>
          </div>
        </div>
      ) : null}
      {group.tracks.length === 0 ? (
        <p className="max-w-md text-sm text-muted">{t('folders.empty')}</p>
      ) : (
        <TrackList
          tracks={group.tracks}
          shouldPlayInOrder
          {...(kind === DownloadGroupKind.Folder ? { folderId: id } : {})}
        />
      )}
      {isRenaming ? <FolderNameDialog folderId={id} onClose={() => setIsRenaming(false)} /> : null}
    </Page>
  );
}
