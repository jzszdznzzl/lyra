import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';
import { Page } from '../../ui/page.tsx';
import { ShareButton } from '../share/share-button.tsx';
import { ShareKind } from '../share/share.ts';
import { trackQuery, upNextQuery } from './api.ts';
import { CollectionHeader } from './collection-header.tsx';
import { ErrorState, LoadingState } from './query-state.tsx';
import { TrackList } from './track-list.tsx';

/** Where a shared song link lands: the song, ready to play, and its radio below. */
export function TrackPage() {
  const { t } = useTranslation();
  const { id } = useParams({ from: '/app/track/$id' });
  const track = useQuery(trackQuery(id));
  const radio = useQuery(upNextQuery(id));
  useDocumentTitle(track.data?.title);

  if (track.isPending) {
    return (
      <Page>
        <LoadingState />
      </Page>
    );
  }

  if (track.isError) {
    return (
      <Page>
        <ErrorState error={track.error} onRetry={() => void track.refetch()} />
      </Page>
    );
  }

  // The radio starts with the song itself; playing from the header keeps that order.
  const similar = (radio.data?.tracks ?? []).filter((item) => item.id !== id);

  return (
    <Page>
      <CollectionHeader
        kind={t('music.song')}
        title={track.data.title}
        subtitle={track.data.artists.map((artist) => artist.name).join(', ')}
        thumbnail={track.data.thumbnail}
        tracks={[track.data, ...similar]}
        actions={<ShareButton kind={ShareKind.Track} id={track.data.id} title={track.data.title} />}
      />
      {similar.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[19px] font-bold tracking-tight">{t('music.similar')}</h2>
          <TrackList tracks={similar} />
        </section>
      ) : null}
    </Page>
  );
}
