import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { forgotPassword } from './api.ts';
import { useErrorText } from './use-error-text.ts';
import type { ApiError } from '../../lib/api.ts';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const [email, setEmail] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await forgotPassword(email);
    setIsBusy(false);
    setError(result.error);
    setIsSent(result.error === null);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('auth.forgot.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('auth.forgot.body')}</p>
      </div>
      {isSent ? <Notice tone={NoticeTone.Success}>{t('auth.forgot.sent')}</Notice> : null}
      {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
      <TextField
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" isBusy={isBusy}>
        {t('auth.forgot.submit')}
      </Button>
      <Link to="/login" className="text-center text-sm font-bold text-muted hover:text-text">
        {t('auth.checkEmail.back')}
      </Link>
    </form>
  );
}
