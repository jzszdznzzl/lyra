import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';

import type { PlaylistPage as PlaylistData } from '@lyra/shared';

import { PlaylistActions } from '../library/playlist-actions.tsx';
import { likedQuery, playlistQuery } from './api.ts';
import { Page } from '../../ui/page.tsx';
import { ShareButton } from '../share/share-button.tsx';
import { ShareKind } from '../share/share.ts';
import { CollectionHeader } from './collection-header.tsx';
import { ErrorState, LoadingState } from './query-state.tsx';
import { TrackList } from './track-list.tsx';
import type { UseQueryResult } from '@tanstack/react-query';

function PlaylistView({
  query,
  title,
  isShareable = true,
}: {
  query: UseQueryResult<PlaylistData>;
  title?: string;
  isShareable?: boolean;
}) {
  const { t } = useTranslation();
  useDocumentTitle(title ?? query.data?.title);

  if (query.isPending) {
    return (
      <Page>
        <LoadingState />
      </Page>
    );
  }

  if (query.isError) {
    return (
      <Page>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Page>
    );
  }

  return (
    <Page>
      <CollectionHeader
        kind={t('music.playlist')}
        title={title ?? query.data.title}
        subtitle={query.data.subtitle || t('music.songs', { count: query.data.tracks.length })}
        thumbnail={query.data.thumbnail}
        tracks={query.data.tracks}
        actions={
          <>
            {isShareable ? (
              <ShareButton kind={ShareKind.Playlist} id={query.data.id} title={query.data.title} />
            ) : null}
            {query.data.isEditable ? (
              <PlaylistActions id={query.data.id} title={query.data.title} />
            ) : null}
          </>
        }
      />
      <TrackList
        shouldPlayInOrder
        tracks={query.data.tracks}
        playlist={{ id: query.data.id, isEditable: query.data.isEditable }}
      />
    </Page>
  );
}

export function PlaylistPage() {
  const { id } = useParams({ from: '/app/playlist/$id' });

  return <PlaylistView query={useQuery(playlistQuery(id))} />;
}

export function LikedPage() {
  const { t } = useTranslation();

  // Liked songs is private to the account; a link to it would open someone else's.
  return (
    <PlaylistView query={useQuery(likedQuery)} title={t('music.likedSongs')} isShareable={false} />
  );
}
