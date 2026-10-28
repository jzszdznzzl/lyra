import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatRelative } from '../../lib/format.ts';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { revokeOtherSessions, revokeSession, sessionsQuery } from '../auth/api.ts';
import { Section } from './section.tsx';

const MOBILE_SYSTEMS = /Android|iOS/;

export function SessionsSection() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const sessions = useQuery(sessionsQuery);
  const hasOthers = (sessions.data ?? []).some((session) => !session.isCurrent);

  const refresh = () => queryClient.invalidateQueries({ queryKey: sessionsQuery.queryKey });

  return (
    <Section
      title={t('profile.sessions.title')}
      aside={
        hasOthers ? (
          <Button
            variant={ButtonVariant.Danger}
            onClick={() => void revokeOtherSessions().then(refresh)}
          >
            {t('profile.sessions.revokeOthers')}
          </Button>
        ) : null
      }
    >
      <ul className="flex flex-col divide-y divide-line">
        {sessions.data?.map((session) => {
          const Icon = MOBILE_SYSTEMS.test(session.device) ? Smartphone : Laptop;

          return (
            <li key={session.id} className="flex items-center gap-4 py-3">
              <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
                <Icon className="size-5 text-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {session.device}
                  {session.isCurrent ? (
                    <span className="ml-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-400">
                      {t('profile.sessions.current')}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted">
                  {session.ip} ·{' '}
                  {t('profile.sessions.lastSeen', {
                    date: formatRelative(session.lastSeenAt, i18n.language),
                  })}
                </p>
              </div>
              {session.isCurrent ? null : (
                <Button
                  variant={ButtonVariant.Ghost}
                  onClick={() => void revokeSession(session.id).then(refresh)}
                >
                  {t('profile.sessions.revoke')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
