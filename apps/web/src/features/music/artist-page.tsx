import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';

import { MediaKind } from '@lyra/shared';
import type { Track } from '@lyra/shared';

import { usePlayerStore } from '../player/player-store.ts';
import { artistQuery } from './api.ts';
import { Page } from '../../ui/page.tsx';
import { ShareButton } from '../share/share-button.tsx';
import { ShareKind } from '../share/share.ts';
import { CollectionHeader } from './collection-header.tsx';
import { ErrorState, LoadingState } from './query-state.tsx';
import { Shelf } from './shelf.tsx';
import { TrackList } from './track-list.tsx';

export function ArtistPage() {
  const { t } = useTranslation();
  const { id } = useParams({ from: '/app/artist/$id' });
  const artist = useQuery(artistQuery(id));
  useDocumentTitle(artist.data?.name);
  const playTracks = usePlayerStore((state) => state.playTracks);

  if (artist.isPending) {
    return (
      <Page>
        <LoadingState />
      </Page>
    );
  }

  if (artist.isError) {
    return (
      <Page>
        <ErrorState error={artist.error} onRetry={() => void artist.refetch()} />
      </Page>
    );
  }

  // The first shelf of song rows is the artist's top songs; it reads better as a list.
  const [first, ...rest] = artist.data.shelves;
  const topSongs: Track[] =
    first?.items.filter(
      (item): item is Track => item.kind === MediaKind.Song || item.kind === MediaKind.Video,
    ) ?? [];
  const shelves = topSongs.length > 0 ? rest : artist.data.shelves;

  return (
    <Page>
      <CollectionHeader
        kind={t('music.artist')}
        title={artist.data.name}
        subtitle={artist.data.subtitle}
        thumbnail={artist.data.thumbnail}
        tracks={topSongs}
        isRound
        actions={
          <ShareButton kind={ShareKind.Artist} id={artist.data.id} title={artist.data.name} />
        }
      />
      {topSongs.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[19px] font-bold tracking-tight">{first?.title}</h2>
          <TrackList tracks={topSongs.slice(0, 10)} />
        </section>
      ) : null}
      {shelves.map((shelf) => (
        <Shelf
          key={shelf.title}
          shelf={shelf}
          onPlay={(track, tracks) => playTracks(tracks, Math.max(0, tracks.indexOf(track)))}
        />
      ))}
    </Page>
  );
}
