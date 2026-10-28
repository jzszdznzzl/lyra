import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, KeyRound } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { GoogleAccount, UserProfile } from '@lyra/shared';

import { Avatar } from '../../ui/avatar.tsx';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Dialog } from '../../ui/dialog.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { meQuery } from '../auth/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { googleQuery, linkWithCookies, unlinkGoogle } from '../google/api.ts';
import { RemoteBrowser } from '../google/remote-browser.tsx';
import { Section } from './section.tsx';
import type { ApiError } from '../../lib/api.ts';

export function GoogleSection({ me }: { me: UserProfile }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const google = useQuery(googleQuery);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [cookie, setCookie] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const account = google.data?.account ?? null;

  const refresh = useCallback(async () => {
    // Everything YT Music shows depends on whose session is used.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: googleQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: meQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: ['music'] }),
    ]);
  }, [queryClient]);

  const linked = useCallback(
    (linkedAccount: GoogleAccount) => {
      queryClient.setQueryData(googleQuery.queryKey, { account: linkedAccount });
      setIsBrowserOpen(false);
      void refresh();
    },
    [queryClient, refresh],
  );

  async function submitCookies(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await linkWithCookies(cookie);
    setIsBusy(false);
    setError(result.error);

    if (result.data?.account) {
      setCookie('');
      linked(result.data.account);
    }
  }

  async function unlink() {
    await unlinkGoogle();
    await refresh();
  }

  return (
    <Section
      title={t('profile.google.title')}
      description={t('profile.google.body')}
      aside={
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${me.isGoogleLinked ? 'bg-emerald-400/15 text-emerald-400' : 'bg-surface-2 text-muted'}`}
        >
          {me.isGoogleLinked ? t('profile.google.linked') : t('profile.google.notLinked')}
        </span>
      }
    >
      {account ? (
        <div className="flex items-center gap-4">
          <Avatar name={account.name} url={account.photo} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{t('google.linkedAs', { name: account.name })}</p>
            {account.email ? <p className="truncate text-sm text-muted">{account.email}</p> : null}
          </div>
          <Button variant={ButtonVariant.Danger} onClick={() => void unlink()}>
            {t('google.unlink')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">{t('google.browser.body')}</p>
            <Button className="self-start" onClick={() => setIsBrowserOpen(true)}>
              <Globe className="size-4" />
              {t('google.browser.start')}
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted uppercase">
            <span className="h-px flex-1 bg-line" />
            {t('google.or')}
            <span className="h-px flex-1 bg-line" />
          </div>
          <form className="flex flex-col gap-2" onSubmit={(event) => void submitCookies(event)}>
            <p className="text-sm font-bold">{t('google.cookies.title')}</p>
            <p className="text-sm text-muted">{t('google.cookies.body')}</p>
            <textarea
              value={cookie}
              onChange={(event) => setCookie(event.target.value)}
              aria-label={t('google.cookies.label')}
              rows={3}
              spellCheck={false}
              className="rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs outline-none focus:border-accent"
            />
            <Button
              type="submit"
              variant={ButtonVariant.Secondary}
              isBusy={isBusy}
              disabled={cookie.trim().length < 20}
              className="self-start"
            >
              <KeyRound className="size-4" />
              {t('google.cookies.submit')}
            </Button>
          </form>
        </div>
      )}
      {isBrowserOpen ? (
        <Dialog title={t('google.browser.title')} onClose={() => setIsBrowserOpen(false)}>
          <RemoteBrowser onLinked={linked} onCancel={() => setIsBrowserOpen(false)} />
        </Dialog>
      ) : null}
    </Section>
  );
}
