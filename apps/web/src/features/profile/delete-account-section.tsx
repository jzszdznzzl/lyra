import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Dialog } from '../../ui/dialog.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { deleteAccount } from '../auth/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { clearLocalData } from '../offline/clear-local-data.ts';
import { Section } from './section.tsx';
import type { ApiError } from '../../lib/api.ts';

export function DeleteAccountSection() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await deleteAccount(password);

    if (result.error) {
      setIsBusy(false);
      setError(result.error);

      return;
    }

    await clearLocalData();
    // A full load drops the player, Connect and every cache held in memory.
    location.assign('/register');
  }

  return (
    <Section title={t('profile.delete.title')} description={t('profile.delete.body')}>
      <Button variant={ButtonVariant.Danger} className="self-start" onClick={() => setIsOpen(true)}>
        <Trash2 className="size-4" />
        {t('profile.delete.button')}
      </Button>
      {isOpen ? (
        <Dialog title={t('profile.delete.confirmTitle')} onClose={() => setIsOpen(false)}>
          <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <p className="text-sm text-muted">{t('profile.delete.confirmBody')}</p>
            {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
            <TextField
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              type="submit"
              variant={ButtonVariant.Danger}
              isBusy={isBusy}
              disabled={password === ''}
            >
              {t('profile.delete.confirm')}
            </Button>
          </form>
        </Dialog>
      ) : null}
    </Section>
  );
}
