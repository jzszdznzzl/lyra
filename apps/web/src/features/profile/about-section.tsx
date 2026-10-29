import { queryOptions, useQuery } from '@tanstack/react-query';
import { CodeXml, ExternalLink, Info, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
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
import { Dialog } from '../../ui/dialog.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import type { ChangelogEntry } from '../../app/version.ts';

const RECENT_ENTRIES = 3;
const REPO_URL = 'https://github.com/jzszdznzzl/lyra';
const CREDITS = [
  { name: 'YouTube Music', url: 'https://music.youtube.com' },
  { name: 'youtubei.js', url: 'https://github.com/LuanRT/YouTube.js' },
  { name: 'LRCLIB', url: 'https://lrclib.net' },
] as const;

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

function ExternalRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-surface"
    >
      {children}
      <ExternalLink className="size-4 shrink-0 text-muted" />
    </a>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
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
    <Dialog title={t('profile.about.title')} onClose={onClose}>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-16 place-items-center rounded-[20px] bg-[conic-gradient(from_200deg,var(--accent),var(--accent-2),var(--accent))] shadow-lg">
          <span className="size-5 rounded-full bg-bg" />
        </span>
        <p className="text-2xl font-extrabold tracking-tight">lyra</p>
        <p className="font-mono text-xs text-muted">{versionLabel(currentBuild.version)}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-sm">
        <p className="font-bold">{t('profile.about.whatTitle')}</p>
        <p className="text-muted">{t('profile.about.what')}</p>
        <p className="text-xs text-muted">{t('profile.about.unofficial')}</p>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <p className="font-bold">{t('profile.about.dataTitle')}</p>
        <p className="text-muted">{t('profile.about.data')}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold">{t('profile.about.versionTitle')}</p>
          <Button
            variant={ButtonVariant.Secondary}
            isBusy={isChecking}
            onClick={() => void check()}
          >
            <RefreshCw className="size-4" />
            {t('profile.about.check')}
          </Button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
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
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold">{t('profile.about.whatsNew')}</p>
        <ChangeList entries={changelog.slice(0, RECENT_ENTRIES)} language={language} />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold">{t('profile.about.credits')}</p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:bg-surface"
        >
          <CodeXml className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">jzszdznzzl/lyra</span>
            <span className="block text-xs text-muted">{t('profile.about.repo')}</span>
          </span>
          <ExternalLink className="size-4 shrink-0 text-muted" />
        </a>
        <p className="mt-2 px-3 text-xs text-muted">{t('profile.about.thanks')}</p>
        {CREDITS.map((credit) => (
          <ExternalRow key={credit.name} href={credit.url}>
            {credit.name}
          </ExternalRow>
        ))}
      </div>
    </Dialog>
  );
}

/** A short line in the profile; the details open in a dialog so the page stays light. */
export function AboutSection() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const isReady = useUpdateStore((state) => state.isReady);
  const latest = useQuery(latestVersionQuery);
  const hasUpdate =
    isReady || (latest.data ? latest.data.build.commit !== currentBuild.commit : false);

  return (
    <section className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-5 backdrop-blur-2xl">
      <span className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-[conic-gradient(from_200deg,var(--accent),var(--accent-2),var(--accent))]">
        <span className="size-3.5 rounded-full bg-bg" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold tracking-tight">{t('profile.about.title')}</p>
        <p className="truncate text-sm text-muted">
          {hasUpdate ? (
            <span className="font-semibold text-success">{t('profile.about.ready')}</span>
          ) : (
            <span className="font-mono text-xs">{versionLabel(currentBuild.version)}</span>
          )}
        </p>
      </div>
      <Button variant={ButtonVariant.Secondary} onClick={() => setIsOpen(true)}>
        <Info className="size-4" />
        {t('profile.about.open')}
      </Button>
      {isOpen ? <AboutDialog onClose={() => setIsOpen(false)} /> : null}
    </section>
  );
}
