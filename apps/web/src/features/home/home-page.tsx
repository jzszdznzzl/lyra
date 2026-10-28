import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { homeQuery } from '../music/api.ts';
import { ErrorState, LoadingState } from '../music/query-state.tsx';
import { Shelf } from '../music/shelf.tsx';
import { usePlayerStore } from '../player/player-store.ts';
import { greetingKey } from './greeting.ts';

export function HomePage() {
  const { t } = useTranslation();
  // Read once on mount: the greeting must not flicker on re-renders.
  const [hour] = useState(() => new Date().getHours());
  const home = useQuery(homeQuery);
  const playTracks = usePlayerStore((state) => state.playTracks);

  return (
    <div className="p-4 sm:p-7">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t(greetingKey(hour))}</h1>
      {home.isPending ? <LoadingState /> : null}
      {home.isError ? <ErrorState error={home.error} onRetry={() => void home.refetch()} /> : null}
      {home.data?.shelves.map((shelf, index) => (
        <Shelf
          key={`${shelf.title}-${index}`}
          shelf={shelf}
          onPlay={(track, tracks) => playTracks(tracks, Math.max(0, tracks.indexOf(track)))}
        />
      ))}
    </div>
  );
}
