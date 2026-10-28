import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Fingerprint } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { ApiError } from '../../lib/api.ts';
import {
  finishPasskeyLogin,
  login,
  meQuery,
  resendVerification,
  startPasskeyLogin,
} from './api.ts';
import { signWithPasskey } from './passkey-client.ts';
import { useErrorText } from './use-error-text.ts';
import type { UserProfile } from '@lyra/shared';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function signedIn(profile: UserProfile) {
    queryClient.setQueryData(meQuery.queryKey, profile);
    await navigate({ to: '/' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);

    const result = await login({ identifier, password });

    setIsBusy(false);

    if (result.error) {
      setError(result.error);

      return;
    }

    await signedIn(result.data);
  }

  async function signInWithPasskey() {
    setError(null);

    const started = await startPasskeyLogin();

    if (started.error) {
      setError(started.error);

      return;
    }

    const signed = await signWithPasskey(started.data.options);

    if (signed.error) {
      setError(signed.error);

      return;
    }

    const result = await finishPasskeyLogin(started.data.challengeId, signed.data);

    if (result.error) {
      setError(result.error);

      return;
    }

    await signedIn(result.data);
  }

  async function resend() {
    // The resend endpoint needs an email; usernames cannot be resolved without revealing accounts.
    if (identifier.includes('@')) {
      await resendVerification(identifier);
    }

    await navigate({ to: '/check-email', search: { email: identifier } });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">{t('auth.login.title')}</h1>
      {error ? (
        <Notice tone={NoticeTone.Error}>
          {errorText(error)}
          {error === ApiError.EmailNotVerified && identifier.includes('@') ? (
            <button
              type="button"
              className="mt-1 block font-bold underline"
              onClick={() => void resend()}
            >
              {t('auth.login.resend')}
            </button>
          ) : null}
        </Notice>
      ) : null}
      <Button variant={ButtonVariant.Secondary} onClick={() => void signInWithPasskey()}>
        <Fingerprint className="size-4" />
        {t('auth.login.passkey')}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted uppercase">
        <span className="h-px flex-1 bg-line" />
        {t('auth.login.or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <TextField
          label={t('auth.identifier')}
          autoComplete="username webauthn"
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={
            <Link to="/forgot-password" className="hover:text-text">
              {t('auth.login.forgot')}
            </Link>
          }
        />
        <Button type="submit" isBusy={isBusy} className="mt-2">
          {t('auth.login.submit')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="font-bold text-text hover:text-accent">
          {t('auth.login.createAccount')}
        </Link>
      </p>
    </div>
  );
}
