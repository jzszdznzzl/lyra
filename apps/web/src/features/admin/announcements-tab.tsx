import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ANNOUNCEMENT_MAX_LENGTH, AnnouncementLevel } from '@lyra/shared';

import { formatRelative } from '../../lib/format.ts';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { announcementsQuery } from '../announcements/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { adminAnnouncementsQuery, endAnnouncement, publishAnnouncement } from './api.ts';
import type { ApiError } from '../../lib/api.ts';

const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;
const DURATIONS = [
  30,
  HOUR_MINUTES,
  6 * HOUR_MINUTES,
  DAY_MINUTES,
  3 * DAY_MINUTES,
  7 * DAY_MINUTES,
];

function durationLabel(minutes: number, language: string) {
  const format = (value: number, unit: 'minute' | 'hour' | 'day') =>
    new Intl.NumberFormat(language, { style: 'unit', unit, unitDisplay: 'long' }).format(value);

  if (minutes % DAY_MINUTES === 0) {
    return format(minutes / DAY_MINUTES, 'day');
  }

  return minutes % HOUR_MINUTES === 0
    ? format(minutes / HOUR_MINUTES, 'hour')
    : format(minutes, 'minute');
}

export function AnnouncementsTab() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const recent = useQuery(adminAnnouncementsQuery);
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState<AnnouncementLevel>(AnnouncementLevel.Info);
  const [duration, setDuration] = useState(DAY_MINUTES);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // When the list was loaded: "live" and "ended" are judged against the data shown.
  const now = recent.dataUpdatedAt;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminAnnouncementsQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: announcementsQuery.queryKey }),
    ]);

  async function publish(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await publishAnnouncement({ message, level, durationMinutes: duration });
    setIsBusy(false);
    setError(result.error);

    if (result.data) {
      setMessage('');
      await refresh();
    }
  }

  async function end(id: string) {
    setError((await endAnnouncement(id)).error);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(event) => void publish(event)}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl sm:p-6"
      >
        <h2 className="text-lg font-bold tracking-tight">{t('admin.announcements.new')}</h2>
        {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wider text-muted uppercase">
            {t('admin.announcements.message')}
          </span>
          <textarea
            required
            rows={3}
            maxLength={ANNOUNCEMENT_MAX_LENGTH}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('admin.announcements.placeholder')}
            className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <span className="self-end text-xs text-muted">
            {message.length}/{ANNOUNCEMENT_MAX_LENGTH}
          </span>
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wider text-muted uppercase">
              {t('admin.announcements.level')}
            </span>
            <div className="flex gap-2">
              {Object.values(AnnouncementLevel).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={level === option}
                  onClick={() => setLevel(option)}
                  className="rounded-full border border-line px-4 py-2 text-sm font-bold text-muted aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
                >
                  {t(`admin.announcements.levels.${option}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wider text-muted uppercase">
              {t('admin.announcements.duration')}
            </span>
            <select
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="h-10 rounded-full border border-line bg-surface-2 px-4 text-sm outline-none focus:border-accent"
            >
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {durationLabel(minutes, i18n.language)}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            isBusy={isBusy}
            disabled={message.trim() === ''}
            className="ml-auto"
          >
            <Megaphone className="size-4" />
            {t('admin.announcements.publish')}
          </Button>
        </div>
      </form>
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl sm:p-6">
        <h2 className="text-lg font-bold tracking-tight">{t('admin.announcements.recent')}</h2>
        {recent.data?.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.announcements.none')}</p>
        ) : null}
        <ul className="flex flex-col divide-y divide-line">
          {recent.data?.map((item) => {
            const isLive = item.expiresAt > now;

            return (
              <li key={item.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm break-words whitespace-pre-line">{item.message}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t(`admin.announcements.levels.${item.level}`)} ·{' '}
                    {t(isLive ? 'admin.announcements.endsIn' : 'admin.announcements.ended', {
                      date: formatRelative(item.expiresAt, i18n.language, now),
                    })}
                  </p>
                </div>
                {isLive ? (
                  <Button variant={ButtonVariant.Ghost} onClick={() => void end(item.id)}>
                    {t('admin.announcements.end')}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
