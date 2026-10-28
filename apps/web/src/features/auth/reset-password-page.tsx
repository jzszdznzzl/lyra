import { Link, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { resetPassword } from './api.ts';
import { PasswordField } from './password-field.tsx';
import { useErrorText } from './use-error-text.ts';
import type { ApiError } from '../../lib/api.ts';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token } = useSearch({ from: '/auth/reset-password' });
  const errorText = useErrorText();
  const [password, setPassword] = useState('');
  const [isStrong, setIsStrong] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await resetPassword(token, password);
    setIsBusy(false);
    setError(result.error);
    setIsDone(result.error === null);
  }

  if (isDone) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone={NoticeTone.Success}>{t('auth.reset.done')}</Notice>
        <Link to="/login" className="text-center text-sm font-bold text-text hover:text-accent">
          {t('auth.register.signIn')}
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <h1 className="text-2xl font-extrabold tracking-tight">{t('auth.reset.title')}</h1>
      {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
      <PasswordField
        label={t('profile.password.new')}
        value={password}
        onChange={setPassword}
        userInputs={[]}
        onStrengthChange={setIsStrong}
      />
      <Button type="submit" isBusy={isBusy} disabled={!isStrong}>
        {t('auth.reset.submit')}
      </Button>
    </form>
  );
}
