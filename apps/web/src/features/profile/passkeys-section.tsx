import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatRelative } from '../../lib/format.ts';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import {
  deletePasskey,
  finishPasskeyRegistration,
  passkeysQuery,
  renamePasskey,
  startPasskeyRegistration,
} from '../auth/api.ts';
import { createPasskey, guessDeviceName } from '../auth/passkey-client.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { Section } from './section.tsx';
import type { ApiError } from '../../lib/api.ts';

export function PasskeysSection() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const passkeys = useQuery(passkeysQuery);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: passkeysQuery.queryKey });

  async function add() {
    setIsBusy(true);
    setError(null);

    try {
      const started = await startPasskeyRegistration();

      if (started.error) {
        setError(started.error);

        return;
      }

      const created = await createPasskey(started.data.options);

      if (created.error) {
        setError(created.error);

        return;
      }

      const saved = await finishPasskeyRegistration(
        started.data.challengeId,
        created.data,
        guessDeviceName(),
      );
      setError(saved.error);
      await refresh();
    } finally {
      setIsBusy(false);
    }
  }

  async function rename(id: string, current: string) {
    const name = window.prompt(t('profile.passkeys.namePrompt'), current)?.trim();

    if (name) {
      await renamePasskey(id, name);
      await refresh();
    }
  }

  async function remove(id: string) {
    await deletePasskey(id);
    await refresh();
  }

  return (
    <Section
      title={t('profile.passkeys.title')}
      description={t('profile.passkeys.body')}
      aside={
        <Button variant={ButtonVariant.Secondary} isBusy={isBusy} onClick={() => void add()}>
          <Fingerprint className="size-4" />
          {t('profile.passkeys.add')}
        </Button>
      }
    >
      {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
      <ul className="flex flex-col divide-y divide-line">
        {passkeys.data?.length === 0 ? (
          <li className="py-2 text-sm text-muted">{t('profile.passkeys.empty')}</li>
        ) : null}
        {passkeys.data?.map((passkey) => (
          <li key={passkey.id} className="flex items-center gap-4 py-3">
            <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
              <Fingerprint className="size-5 text-muted" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{passkey.name}</p>
              <p className="text-xs text-muted">
                {passkey.lastUsedAt
                  ? t('profile.passkeys.lastUsed', {
                      date: formatRelative(passkey.lastUsedAt, i18n.language),
                    })
                  : t('profile.passkeys.created', {
                      date: formatRelative(passkey.createdAt, i18n.language),
                    })}
              </p>
            </div>
            <Button
              variant={ButtonVariant.Ghost}
              aria-label={t('profile.passkeys.rename')}
              onClick={() => void rename(passkey.id, passkey.name)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant={ButtonVariant.Ghost}
              aria-label={t('profile.passkeys.remove')}
              onClick={() => void remove(passkey.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
