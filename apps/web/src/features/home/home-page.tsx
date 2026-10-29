import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';

import { meQuery } from '../auth/api.ts';
import { homeQuery } from '../music/api.ts';
import { ErrorState, LoadingState } from '../music/query-state.tsx';
import { Shelf } from '../music/shelf.tsx';
import { usePlayerStore } from '../player/player-store.ts';
import { firstName, greetingKey } from './greeting.ts';
import { QuickAccess } from './quick-access.tsx';

export function HomePage() {
  const { t } = useTranslation();
  // Read once on mount: the greeting must not flicker on re-renders.
  const [hour] = useState(() => new Date().getHours());
  const home = useQuery(homeQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  useDocumentTitle(null);
  const playRadio = usePlayerStore((state) => state.playRadio);
  const greeting = t(greetingKey(hour));
  const name = me ? firstName(me.name) : null;

  return (
    <div className="p-4 sm:p-7">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {name ? t('home.greetingWithName', { greeting, name }) : greeting}
      </h1>
      {me?.isGoogleLinked ? <QuickAccess /> : null}
      {home.isPending ? <LoadingState /> : null}
      {home.isError ? <ErrorState error={home.error} onRetry={() => void home.refetch()} /> : null}
      {home.data?.shelves.map((shelf, index) => (
        <Shelf key={`${shelf.title}-${index}`} shelf={shelf} onPlay={(track) => playRadio(track)} />
      ))}
    </div>
  );
}
