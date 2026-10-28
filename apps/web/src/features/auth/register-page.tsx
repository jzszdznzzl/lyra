import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Language } from '@lyra/shared';

import { Button } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { register } from './api.ts';
import { PasswordField } from './password-field.tsx';
import { useErrorText } from './use-error-text.ts';
import type { ApiError } from '../../lib/api.ts';

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isStrong, setIsStrong] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);

    const language = Object.values(Language).find((value) => value === i18n.language);
    const result = await register({
      email,
      username,
      name,
      password,
      ...(language ? { language } : {}),
    });

    setIsBusy(false);

    if (result.error) {
      setError(result.error);

      return;
    }

    await navigate({ to: '/check-email', search: { email: result.data.email } });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <div className="mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('auth.register.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('auth.register.subtitle')}</p>
      </div>
      {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
      <TextField
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('auth.name')}
          autoComplete="name"
          required
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('auth.username')}
          autoComplete="username"
          required
          pattern="[a-z0-9_]{3,20}"
          title={t('auth.usernameHint')}
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
        />
      </div>
      <PasswordField
        label={t('auth.password')}
        value={password}
        onChange={setPassword}
        userInputs={[email, username, name]}
        onStrengthChange={setIsStrong}
      />
      <Button type="submit" isBusy={isBusy} disabled={!isStrong} className="mt-2">
        {t('auth.register.submit')}
      </Button>
      <p className="text-center text-sm text-muted">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-bold text-text hover:text-accent">
          {t('auth.register.signIn')}
        </Link>
      </p>
    </form>
  );
}
