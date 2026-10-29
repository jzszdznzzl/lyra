import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { History, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';

import { SearchFilter } from '@lyra/shared';

import { ApiError, ApiFailure } from '../../lib/api.ts';
import { useOnline } from '../../lib/use-online.ts';
import { useDownloads } from '../offline/downloads.ts';
import { searchDownloads } from '../offline/search-downloads.ts';
import { usePlayerStore } from '../player/player-store.ts';
import { searchQuery, suggestionsQuery } from './api.ts';
import { useRecentSearches } from './recent-searches.ts';
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
  const playRadio = usePlayerStore((state) => state.playRadio);
  const [draft, setDraft] = useState(q);
  const [isFocused, setIsFocused] = useState(false);
  const typed = useDebounced(draft);
  const suggestions = useQuery({
    ...suggestionsQuery(typed),
    enabled: isFocused && typed.trim() !== '' && typed !== q,
  });
  const results = useQuery(searchQuery(q, filter));
  const recent = useRecentSearches((state) => state.queries);
  const removeRecent = useRecentSearches((state) => state.remove);
  const clearRecent = useRecentSearches((state) => state.clear);

  // Every search that runs (typed, suggested or from a link) joins the history.
  useEffect(() => {
    if (q.trim() !== '') {
      useRecentSearches.getState().add(q);
    }
  }, [q]);
  useDocumentTitle(q ? `${q} · ${t('nav.search')}` : t('nav.search'));

  function submit(query: string) {
    setDraft(query);
    setIsFocused(false);
    void navigate({ search: { q: query, filter }, replace: true });
  }

  const items = results.data?.items ?? [];
  const isOnline = useOnline();
  const records = useDownloads((state) => state.records);
  // React Query pauses requests offline, so without this the page would spin forever.
  const isOffline =
    !isOnline || (results.error instanceof ApiFailure && results.error.code === ApiError.Network);
  const offlineResults = useMemo(
    () =>
      isOffline
        ? searchDownloads(
            [...records.values()].map((record) => record.track),
            q,
          )
        : [],
    [isOffline, records, q],
  );
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
      {q === '' && recent.length > 0 ? (
        <section className="flex max-w-xl flex-col gap-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-muted uppercase">
              {t('search.recent')}
            </h2>
            <button
              type="button"
              onClick={clearRecent}
              className="text-xs font-bold text-muted hover:text-text"
            >
              {t('search.clearRecent')}
            </button>
          </div>
          <ul>
            {recent.map((query) => (
              <li key={query} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => submit(query)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left text-[15px] hover:bg-surface"
                >
                  <History className="size-4 shrink-0 text-muted" />
                  <span className="truncate">{query}</span>
                </button>
                <button
                  type="button"
                  aria-label={t('search.removeRecent', { query })}
                  onClick={() => removeRecent(query)}
                  className="rounded-full p-2 text-muted hover:bg-surface hover:text-text"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {q !== '' && isOffline ? (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-bold tracking-wider text-muted uppercase">
            {t('search.fromDownloads')}
          </p>
          {offlineResults.length === 0 ? (
            <p className="text-muted">{t('search.empty', { query: q })}</p>
          ) : (
            <TrackList tracks={offlineResults} shouldPlayInOrder />
          )}
        </section>
      ) : q === '' ? null : results.isPending ? (
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
                  onPlay={(track) => playRadio(track)}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
