import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Folder, FolderPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useDocumentTitle } from '../../lib/use-document-title.ts';

import { formatBytes } from '../../lib/format.ts';
import { Cover } from '../../ui/cover.tsx';
import { Page } from '../../ui/page.tsx';
import { CollectionHeader } from '../music/collection-header.tsx';
import { TrackList } from '../music/track-list.tsx';
import { DownloadGroupKind, groupByAlbum, groupByArtist } from './download-groups.ts';
import { storageEstimate, useDownloads } from './downloads.ts';
import { FolderNameDialog } from './folder-dialogs.tsx';
import { sortedFolders, useFolders } from './folders.ts';
import type { DownloadGroup } from './download-groups.ts';

export const DownloadsView = Object.freeze({
  Songs: 'songs',
  Folders: 'folders',
  Albums: 'albums',
  Artists: 'artists',
} as const);

export type DownloadsView = (typeof DownloadsView)[keyof typeof DownloadsView];

export const DownloadsSearch = z.object({
  view: z.enum(DownloadsView).optional().catch(undefined),
});

function GroupGrid({ groups, kind }: { groups: DownloadGroup[]; kind: DownloadGroupKind }) {
  const { t } = useTranslation();

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
      {groups.map((group) => (
        <li key={group.key} className="relative">
          <Link
            to={kind === DownloadGroupKind.Album ? '/downloads/album/$id' : '/downloads/artist/$id'}
            params={{ id: group.key }}
            className="block rounded-xl"
          >
            <Cover
              src={group.thumbnail}
              alt={group.name}
              isRound={kind === DownloadGroupKind.Artist}
              className="aspect-square w-full shadow-xl shadow-black/30"
            />
            <p className="mt-2.5 truncate text-sm font-bold">{group.name}</p>
            <p className="truncate text-xs text-muted">
              {t('music.songs', { count: group.tracks.length })}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DownloadsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { view = DownloadsView.Songs } = useSearch({ from: '/app/downloads' });
  const records = useDownloads((state) => state.records);
  const folders = useFolders((state) => state.folders);
  const [isCreating, setIsCreating] = useState(false);
  useDocumentTitle(t('offline.title'));
  const [used, setUsed] = useState<number | null>(null);
  const tracks = useMemo(
    () =>
      [...records.values()]
        .sort((a, b) => b.downloadedAt - a.downloadedAt)
        .map((record) => record.track),
    [records],
  );

  useEffect(() => {
    void storageEstimate().then((estimate) => setUsed(estimate.used));
  }, [records]);

  return (
    <Page>
      <CollectionHeader
        kind={t('music.playlist')}
        title={t('offline.title')}
        subtitle={[
          t('music.songs', { count: tracks.length }),
          used === null ? '' : t('offline.storage', { used: formatBytes(used) }),
        ]
          .filter(Boolean)
          .join(' · ')}
        thumbnail={tracks[0]?.thumbnail ?? null}
        tracks={tracks}
      />
      {tracks.length === 0 ? (
        <p className="max-w-md text-sm text-muted">{t('offline.empty')}</p>
      ) : (
        <>
          <div role="tablist" className="flex flex-wrap gap-2">
            {Object.values(DownloadsView).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() =>
                  void navigate({
                    to: '/downloads',
                    search: option === DownloadsView.Songs ? {} : { view: option },
                    replace: true,
                  })
                }
                className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-muted aria-selected:border-transparent aria-selected:bg-text aria-selected:text-bg"
              >
                {t(`folders.views.${option}`)}
              </button>
            ))}
          </div>
          {view === DownloadsView.Songs ? <TrackList tracks={tracks} shouldPlayInOrder /> : null}
          {view === DownloadsView.Folders ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
              <li>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm font-bold text-muted hover:border-accent hover:text-accent"
                >
                  <FolderPlus className="size-8" />
                  {t('folders.new')}
                </button>
              </li>
              {sortedFolders(folders).map((folder) => {
                const count = folder.trackIds.filter((id) => records.has(id)).length;

                return (
                  <li key={folder.id}>
                    <Link
                      to="/downloads/folder/$id"
                      params={{ id: folder.id }}
                      className="block rounded-xl"
                    >
                      <div className="grid aspect-square w-full place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/20 shadow-xl shadow-black/20">
                        <Folder className="size-14 text-accent" />
                      </div>
                      <p className="mt-2.5 truncate text-sm font-bold">{folder.name}</p>
                      <p className="truncate text-xs text-muted">{t('music.songs', { count })}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {view === DownloadsView.Albums ? (
            <GroupGrid groups={groupByAlbum(tracks)} kind={DownloadGroupKind.Album} />
          ) : null}
          {view === DownloadsView.Artists ? (
            <GroupGrid groups={groupByArtist(tracks)} kind={DownloadGroupKind.Artist} />
          ) : null}
        </>
      )}
      {isCreating ? (
        <FolderNameDialog
          onClose={() => setIsCreating(false)}
          onSaved={(id) => void navigate({ to: '/downloads/folder/$id', params: { id } })}
        />
      ) : null}
    </Page>
  );
}
