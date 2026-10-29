import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';
import { Page } from '../../ui/page.tsx';
import { usePlayerStore } from '../player/player-store.ts';
import { exploreQuery } from './api.ts';
import { ErrorState, LoadingState } from './query-state.tsx';
import { Shelf } from './shelf.tsx';

export function ExplorePage() {
  const { t } = useTranslation();
  const explore = useQuery(exploreQuery);
  const playRadio = usePlayerStore((state) => state.playRadio);
  useDocumentTitle(t('nav.explore'));

  return (
    <Page>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('nav.explore')}</h1>
      {explore.isPending ? <LoadingState /> : null}
      {explore.isError ? (
        <ErrorState error={explore.error} onRetry={() => void explore.refetch()} />
      ) : null}
      {explore.data?.shelves.map((shelf, index) => (
        <Shelf key={`${shelf.title}-${index}`} shelf={shelf} onPlay={(track) => playRadio(track)} />
      ))}
    </Page>
  );
}
