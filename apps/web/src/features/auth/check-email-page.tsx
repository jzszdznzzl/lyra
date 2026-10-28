import { Link, useSearch } from '@tanstack/react-router';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { resendVerification } from './api.ts';
import { useErrorText } from './use-error-text.ts';
import type { ApiError } from '../../lib/api.ts';

export function CheckEmailPage() {
  const { t } = useTranslation();
  const { email } = useSearch({ from: '/auth/check-email' });
  const errorText = useErrorText();
  const [isSent, setIsSent] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function resend() {
    setIsBusy(true);
    const result = await resendVerification(email);
    setIsBusy(false);
    setError(result.error);
    setIsSent(result.error === null);
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/15 text-accent">
        <MailCheck className="size-7" />
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight">{t('auth.checkEmail.title')}</h1>
      <p className="text-sm text-muted">{t('auth.checkEmail.body', { email })}</p>
      {isSent ? <Notice tone={NoticeTone.Success}>{t('auth.checkEmail.resent')}</Notice> : null}
      {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
      {email.includes('@') ? (
        <Button variant={ButtonVariant.Secondary} isBusy={isBusy} onClick={() => void resend()}>
          {t('auth.checkEmail.resend')}
        </Button>
      ) : null}
      <Link to="/login" className="text-sm font-bold text-muted hover:text-text">
        {t('auth.checkEmail.back')}
      </Link>
    </div>
  );
}
