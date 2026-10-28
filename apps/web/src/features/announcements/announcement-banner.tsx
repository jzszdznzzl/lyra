import { useQuery } from '@tanstack/react-query';
import { Info, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnnouncementLevel } from '@lyra/shared';

import { announcementsQuery } from './api.ts';
import { readDismissed, rememberDismissed } from './dismissed.ts';

const LEVEL_CLASSES: Record<AnnouncementLevel, string> = {
  [AnnouncementLevel.Info]: 'border-accent/30 bg-accent/10 text-text',
  [AnnouncementLevel.Warning]: 'border-warning/30 bg-warning/10 text-warning',
};

/** Announcements from the server's admins, until they expire or the user closes them. */
export function AnnouncementBanner() {
  const { t } = useTranslation();
  const announcements = useQuery(announcementsQuery);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [now, setNow] = useState(Date.now);
  const shown = (announcements.data ?? []).filter(
    (item) => item.expiresAt > now && !dismissed.includes(item.id),
  );
  const nextExpiry = Math.min(...shown.map((item) => item.expiresAt));

  // Re-render when the next one expires, so it disappears on time without a refetch.
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) {
      return;
    }

    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()) + 50);

    return () => clearTimeout(timer);
  }, [nextExpiry]);

  if (shown.length === 0) {
    return null;
  }

  return (
    <div className="mx-4 mt-3 flex flex-col gap-2 sm:mx-7">
      {shown.map((item) => {
        const Icon = item.level === AnnouncementLevel.Warning ? TriangleAlert : Info;

        return (
          <div
            key={item.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${LEVEL_CLASSES[item.level]}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <p className="min-w-0 flex-1 break-words whitespace-pre-line">{item.message}</p>
            <button
              type="button"
              aria-label={t('announcements.dismiss')}
              onClick={() => setDismissed(rememberDismissed(item.id))}
              className="-m-1 rounded-full p-1 opacity-70 hover:bg-surface hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
