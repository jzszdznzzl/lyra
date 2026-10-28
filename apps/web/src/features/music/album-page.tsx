import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { albumQuery } from './api.ts';
import { CollectionHeader } from './collection-header.tsx';
import { ErrorState, LoadingState } from './query-state.tsx';
import { TrackList } from './track-list.tsx';

export function AlbumPage() {
  const { t } = useTranslation();
  const { id } = useParams({ from: '/app/album/$id' });
  const album = useQuery(albumQuery(id));

  if (album.isPending) {
    return <LoadingState />;
  }

  if (album.isError) {
    return <ErrorState error={album.error} onRetry={() => void album.refetch()} />;
  }

  return (
    <>
      <CollectionHeader
        kind={t('music.album')}
        title={album.data.title}
        subtitle={album.data.subtitle}
        thumbnail={album.data.thumbnail}
        tracks={album.data.tracks}
      />
      <TrackList tracks={album.data.tracks} showCovers={false} showIndex />
    </>
  );
}
