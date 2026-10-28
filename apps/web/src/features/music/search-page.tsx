import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SearchFilter } from '@lyra/shared';

import { usePlayerStore } from '../player/player-store.ts';
import { searchQuery, suggestionsQuery } from './api.ts';
import { isTrack } from './links.ts';
import { MediaCard } from './media-card.tsx';
import { ErrorState, LoadingState } from './query-state.tsx';
import { TrackList } from './track-list.tsx';

const TYPING_DELAY_MS = 300;
const TOP_TRACKS = 8;

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), TYPING_DELAY_MS);

    return () => clearTimeout(timer);
  }, [value]);

  return debounced;
}

export function SearchPage() {
  const { t } = useTranslation();
  const { q, filter } = useSearch({ from: '/app/search' });
  const navigate = useNavigate({ from: '/search' });
  const playTracks = usePlayerStore((state) => state.playTracks);
  const [draft, setDraft] = useState(q);
  const [isFocused, setIsFocused] = useState(false);
  const typed = useDebounced(draft);
  const suggestions = useQuery({
    ...suggestionsQuery(typed),
    enabled: isFocused && typed.trim() !== '' && typed !== q,
  });
  const results = useQuery(searchQuery(q, filter));

  function submit(query: string) {
    setDraft(query);
    setIsFocused(false);
    void navigate({ search: { q: query, filter }, replace: true });
  }

  const items = results.data?.items ?? [];
  const tracks = items.filter(isTrack);
  const cards = items.filter((item) => !isTrack(item));

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-7">
      <form
        className="relative max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft.trim());
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={draft}
          autoFocus={q === ''}
          placeholder={t('search.placeholder')}
          aria-label={t('search.prompt')}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          className="h-12 w-full rounded-full border border-line bg-surface-2 pr-5 pl-11 text-[15px] outline-none focus:border-accent"
        />
        {isFocused && (suggestions.data?.suggestions.length ?? 0) > 0 ? (
          <ul className="absolute inset-x-0 top-14 z-20 overflow-hidden rounded-2xl border border-line bg-bg/95 py-2 shadow-2xl backdrop-blur-xl">
            {suggestions.data?.suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-surface"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => submit(suggestion)}
                >
                  <Search className="size-4 text-muted" />
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
      <div className="flex flex-wrap gap-2">
        {Object.values(SearchFilter).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => void navigate({ search: { q, filter: option }, replace: true })}
            className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-muted aria-pressed:bg-text aria-pressed:text-bg"
          >
            {t(`search.filters.${option}`)}
          </button>
        ))}
      </div>
      {q === '' ? null : results.isPending ? (
        <LoadingState />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : items.length === 0 ? (
        <p className="text-muted">{t('search.empty', { query: q })}</p>
      ) : (
        <>
          {tracks.length > 0 ? (
            <TrackList
              tracks={filter === SearchFilter.All ? tracks.slice(0, TOP_TRACKS) : tracks}
            />
          ) : null}
          {cards.length > 0 ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {cards.map((item) => (
                <MediaCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  onPlay={(track) => playTracks([track], 0)}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
