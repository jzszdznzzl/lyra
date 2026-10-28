import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';

import { albumQuery } from './api.ts';
import { Page } from '../../ui/page.tsx';
import { ShareButton } from '../share/share-button.tsx';
import { ShareKind } from '../share/share.ts';
import { CollectionHeader } from './collection-header.tsx';
import { ErrorState, LoadingState } from './query-state.tsx';
import { TrackList } from './track-list.tsx';

export function AlbumPage() {
  const { t } = useTranslation();
  const { id } = useParams({ from: '/app/album/$id' });
  const album = useQuery(albumQuery(id));
  useDocumentTitle(album.data?.title);

  if (album.isPending) {
    return (
      <Page>
        <LoadingState />
      </Page>
    );
  }

  if (album.isError) {
    return (
      <Page>
        <ErrorState error={album.error} onRetry={() => void album.refetch()} />
      </Page>
    );
  }

  return (
    <Page>
      <CollectionHeader
        kind={t('music.album')}
        title={album.data.title}
        subtitle={album.data.subtitle}
        thumbnail={album.data.thumbnail}
        tracks={album.data.tracks}
        actions={<ShareButton kind={ShareKind.Album} id={album.data.id} title={album.data.title} />}
      />
      <TrackList tracks={album.data.tracks} showCovers={false} showIndex />
    </Page>
  );
}
