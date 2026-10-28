import { Crown } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';
import { Page } from '../../ui/page.tsx';
import { AnnouncementsTab } from './announcements-tab.tsx';
import { SettingsTab } from './settings-tab.tsx';
import { StatsTab } from './stats-tab.tsx';
import { UsersTab } from './users-tab.tsx';

interface AdminTab {
  id: string;
  label: string;
  content: ReactNode;
}

export function AdminPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('admin.title'));
  const tabs: AdminTab[] = [
    { id: 'stats', label: t('admin.tabs.stats'), content: <StatsTab /> },
    { id: 'users', label: t('admin.tabs.users'), content: <UsersTab /> },
    { id: 'announcements', label: t('admin.tabs.announcements'), content: <AnnouncementsTab /> },
    { id: 'settings', label: t('admin.tabs.settings'), content: <SettingsTab /> },
  ];
  const [selected, setSelected] = useState(tabs[0]?.id ?? null);
  const current = tabs.find((tab) => tab.id === selected) ?? tabs[0];

  return (
    <Page>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pt-3">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <Crown className="size-7 fill-amber-400 text-amber-500" />
          {t('admin.title')}
        </h1>
        {tabs.length > 0 ? (
          <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === current?.id}
                onClick={() => setSelected(tab.id)}
                className="shrink-0 rounded-full border border-line px-4 py-2 text-sm font-bold text-muted transition aria-selected:border-transparent aria-selected:bg-text aria-selected:text-bg"
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
        {current ? <div role="tabpanel">{current.content}</div> : null}
      </div>
    </Page>
  );
}
