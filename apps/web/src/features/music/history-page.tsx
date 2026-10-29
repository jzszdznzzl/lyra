import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { Page } from '../../ui/page.tsx';
import { meQuery } from '../auth/api.ts';
import { historyQuery } from './api.ts';
import { ErrorState, LoadingState } from './query-state.tsx';
import { TrackList } from './track-list.tsx';

/** YT Music's own history, so songs heard on any device or app show up, not only in Lyra. */
export function HistoryPage() {
  const { t } = useTranslation();
  const { data: me } = useSuspenseQuery(meQuery);
  const history = useQuery({ ...historyQuery, enabled: me?.isGoogleLinked ?? false });
  useDocumentTitle(t('music.history.title'));
  // Without Google there is no history; without sending plays, Lyra's songs are missing from it.
  const notice = !me?.isGoogleLinked
    ? 'music.history.link'
    : me.isYoutubeHistoryEnabled
      ? null
      : 'music.history.notSent';

  return (
    <Page>
      <h1 className="mt-6 mb-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t('music.history.title')}
      </h1>
      <p className="mb-5 text-sm text-muted">{t('music.history.hint')}</p>
      {notice ? (
        <div className="mb-5">
          <Notice tone={NoticeTone.Info}>
            <Link to="/profile" className="underline">
              {t(notice)}
            </Link>
          </Notice>
        </div>
      ) : null}
      {history.isPending && me?.isGoogleLinked ? <LoadingState /> : null}
      {history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : null}
      {history.data?.sections.length === 0 ? (
        <p className="text-muted">{t('music.history.empty')}</p>
      ) : null}
      {history.data?.sections.map((section, index) => (
        <section key={`${section.title}-${index}`} className="mt-4">
          <h2 className="mb-2 text-[19px] font-bold tracking-tight">{section.title}</h2>
          <TrackList tracks={section.tracks} />
        </section>
      ))}
    </Page>
  );
}
