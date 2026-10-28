import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { UserProfile } from '@lyra/shared';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { changePassword } from '../auth/api.ts';
import { PasswordField } from '../auth/password-field.tsx';
import { useErrorText } from '../auth/use-error-text.ts';
import { Section } from './section.tsx';
import type { ApiError } from '../../lib/api.ts';

export function PasswordSection({ me }: { me: UserProfile }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isStrong, setIsStrong] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await changePassword({ currentPassword, newPassword });
    setIsBusy(false);
    setError(result.error);
    setIsDone(result.error === null);

    if (result.error === null) {
      setCurrentPassword('');
      setNewPassword('');
    }
  }

  return (
    <Section title={t('profile.password.title')}>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
        {isDone ? <Notice tone={NoticeTone.Success}>{t('profile.password.done')}</Notice> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('profile.password.current')}
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <PasswordField
            label={t('profile.password.new')}
            value={newPassword}
            onChange={setNewPassword}
            userInputs={[me.email, me.username, me.name]}
            onStrengthChange={setIsStrong}
          />
        </div>
        <Button
          type="submit"
          variant={ButtonVariant.Secondary}
          isBusy={isBusy}
          disabled={!isStrong || currentPassword === ''}
          className="self-start"
        >
          {t('profile.password.submit')}
        </Button>
      </form>
    </Section>
  );
}
