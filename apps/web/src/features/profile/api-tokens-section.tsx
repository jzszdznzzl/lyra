import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { TOKEN_NAME_MAX_LENGTH } from '@lyra/shared';

import { copyText } from '../../lib/clipboard.ts';
import { formatRelative } from '../../lib/format.ts';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { useToast } from '../../ui/toast.tsx';
import { apiTokensQuery, createApiToken, revokeApiToken } from '../auth/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { Section } from './section.tsx';
import type { ApiError } from '../../lib/api.ts';

export function ApiTokensSection() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const showToast = useToast((state) => state.show);
  const tokens = useQuery(apiTokensQuery);
  const [name, setName] = useState('');
  // The secret exists only in this answer; once the section is left it cannot be seen again.
  const [created, setCreated] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const endpoint = `${window.location.origin}/api/me/now-playing`;

  const refresh = () => queryClient.invalidateQueries({ queryKey: apiTokensQuery.queryKey });

  async function create(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await createApiToken(name.trim());
    setIsBusy(false);
    setError(result.error);

    if (result.data) {
      setCreated(result.data.token);
      setName('');
      await refresh();
    }
  }

  async function revoke(id: string) {
    await revokeApiToken(id);
    await refresh();
  }

  async function copy(text: string) {
    showToast(
      t((await copyText(text)) ? 'profile.listening.copied' : 'profile.listening.copyFailed'),
    );
  }

  return (
    <Section title={t('profile.tokens.title')} description={t('profile.tokens.body')}>
      <div className="flex flex-col gap-4">
        {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
        {created ? (
          <Notice tone={NoticeTone.Success}>
            <p className="mb-2">{t('profile.tokens.createdOnce')}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-text">
                {created}
              </code>
              <Button variant={ButtonVariant.Secondary} onClick={() => void copy(created)}>
                <Copy className="size-4" />
                {t('profile.tokens.copy')}
              </Button>
            </div>
          </Notice>
        ) : null}
        <form className="flex items-end gap-2" onSubmit={(event) => void create(event)}>
          <TextField
            className="flex-1"
            label={t('profile.tokens.name')}
            placeholder={t('profile.tokens.namePlaceholder')}
            value={name}
            maxLength={TOKEN_NAME_MAX_LENGTH}
            required
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" variant={ButtonVariant.Secondary} isBusy={isBusy}>
            <KeyRound className="size-4" />
            {t('profile.tokens.create')}
          </Button>
        </form>
        <ul className="flex flex-col divide-y divide-line">
          {tokens.data?.length === 0 ? (
            <li className="py-2 text-sm text-muted">{t('profile.tokens.empty')}</li>
          ) : null}
          {tokens.data?.map((token) => (
            <li key={token.id} className="flex items-center gap-4 py-3">
              <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
                <KeyRound className="size-5 text-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{token.name}</p>
                <p className="text-xs text-muted">
                  {token.lastUsedAt
                    ? t('profile.tokens.lastUsed', {
                        date: formatRelative(token.lastUsedAt, i18n.language),
                      })
                    : t('profile.tokens.neverUsed', {
                        date: formatRelative(token.createdAt, i18n.language),
                      })}
                </p>
              </div>
              <Button
                variant={ButtonVariant.Ghost}
                aria-label={t('profile.tokens.revoke')}
                onClick={() => void revoke(token.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 text-xs text-muted">
          <p>{t('profile.tokens.howTo')}</p>
          <code className="overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 font-mono whitespace-nowrap text-text">
            {`curl -H "Authorization: Bearer lyra_…" ${endpoint}`}
          </code>
          <p>{t('profile.tokens.events', { path: '/api/me/now-playing/events' })}</p>
        </div>
      </div>
    </Section>
  );
}
