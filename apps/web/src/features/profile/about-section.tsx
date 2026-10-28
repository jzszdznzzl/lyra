import { queryOptions, useQuery } from '@tanstack/react-query';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_LANGUAGE, Language } from '@lyra/shared';

import { applyUpdate, checkForUpdate, useUpdateStore } from '../../app/updates.ts';
import {
  changelog,
  currentBuild,
  fetchLatest,
  installedAt,
  newChanges,
  versionLabel,
} from '../../app/version.ts';
import { formatRelative } from '../../lib/format.ts';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { Section } from './section.tsx';
import type { ChangelogEntry } from '../../app/version.ts';

const RECENT_ENTRIES = 5;

const latestVersionQuery = queryOptions({
  queryKey: ['latest-version'],
  queryFn: fetchLatest,
  staleTime: 5 * 60 * 1000,
});

function formatDate(value: string, language: string) {
  // A bare date ("2026-10-28") is read at noon, so no time zone moves it to another day.
  const isDay = value.length === 10;

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    ...(isDay ? {} : { timeStyle: 'short' }),
  }).format(new Date(isDay ? `${value}T12:00:00` : value));
}

function ChangeList({ entries, language }: { entries: ChangelogEntry[]; language: Language }) {
  const { i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => (
        <div key={entry.id}>
          <p className="mb-1.5 text-xs font-bold tracking-wider text-muted uppercase">
            {formatDate(entry.date, i18n.language)}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {entry.changes[language].map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AboutSection() {
  const { t, i18n } = useTranslation();
  const isReady = useUpdateStore((state) => state.isReady);
  const latest = useQuery(latestVersionQuery);
  const [installed] = useState(() => installedAt());
  const [isChecking, setIsChecking] = useState(false);
  const language =
    Object.values(Language).find((option) => option === i18n.language) ?? DEFAULT_LANGUAGE;
  const newer =
    latest.data && latest.data.build.commit !== currentBuild.commit ? latest.data : null;

  async function check() {
    setIsChecking(true);
    await Promise.all([checkForUpdate(), latest.refetch()]);
    setIsChecking(false);
  }

  return (
    <Section
      title={t('profile.about.title')}
      aside={
        <Button variant={ButtonVariant.Secondary} isBusy={isChecking} onClick={() => void check()}>
          <RefreshCw className="size-4" />
          {t('profile.about.check')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">{t('profile.about.version')}</dt>
          <dd className="font-mono">{versionLabel(currentBuild.version)}</dd>
          <dt className="text-muted">{t('profile.about.published')}</dt>
          <dd>{formatDate(currentBuild.builtAt, i18n.language)}</dd>
          <dt className="text-muted">{t('profile.about.updatedHere')}</dt>
          <dd>{formatRelative(installed, i18n.language)}</dd>
        </dl>
        {newer || isReady ? (
          <Notice tone={NoticeTone.Success}>
            <div className="flex flex-col gap-3">
              <p className="font-bold">
                {newer
                  ? t('profile.about.available', {
                      version: versionLabel(newer.build.version),
                      date: formatDate(newer.build.builtAt, i18n.language),
                    })
                  : t('profile.about.ready')}
              </p>
              {newer && newChanges(newer.changelog).length > 0 ? (
                <ChangeList entries={newChanges(newer.changelog)} language={language} />
              ) : null}
              <Button className="self-start" onClick={applyUpdate}>
                <Sparkles className="size-4" />
                {t('profile.about.update')}
              </Button>
            </div>
          </Notice>
        ) : null}
        {!newer && !isReady && latest.isFetched && latest.data ? (
          <p className="text-sm text-muted">{t('profile.about.upToDate')}</p>
        ) : null}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold">{t('profile.about.whatsNew')}</h3>
          <ChangeList entries={changelog.slice(0, RECENT_ENTRIES)} language={language} />
        </div>
      </div>
    </Section>
  );
}
