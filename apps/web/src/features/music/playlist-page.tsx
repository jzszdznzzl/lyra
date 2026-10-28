import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import type { PlaylistPage as PlaylistData } from '@lyra/shared';

import { likedQuery, playlistQuery } from './api.ts';
import { CollectionHeader } from './collection-header.tsx';
import { ErrorState, LoadingState } from './query-state.tsx';
import { TrackList } from './track-list.tsx';
import type { UseQueryResult } from '@tanstack/react-query';

function PlaylistView({ query, title }: { query: UseQueryResult<PlaylistData>; title?: string }) {
  const { t } = useTranslation();

  if (query.isPending) {
    return <LoadingState />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <>
      <CollectionHeader
        kind={t('music.playlist')}
        title={title ?? query.data.title}
        subtitle={query.data.subtitle || t('music.songs', { count: query.data.tracks.length })}
        thumbnail={query.data.thumbnail}
        tracks={query.data.tracks}
      />
      <TrackList tracks={query.data.tracks} />
    </>
  );
}

export function PlaylistPage() {
  const { id } = useParams({ from: '/app/playlist/$id' });

  return <PlaylistView query={useQuery(playlistQuery(id))} />;
}

export function LikedPage() {
  const { t } = useTranslation();

  return <PlaylistView query={useQuery(likedQuery)} title={t('music.likedSongs')} />;
}
