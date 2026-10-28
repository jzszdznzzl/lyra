import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { MusicError } from '@lyra/shared';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Dialog } from '../../ui/dialog.tsx';
import { usePlayerStore } from './player-store.ts';

/** Explains that this server can only play songs through the user's own Google account. */
export function GoogleRequiredDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const block = usePlayerStore((state) => state.googleBlock);
  const dismiss = usePlayerStore((state) => state.dismissGoogleBlock);

  if (!block) {
    return null;
  }

  return (
    <Dialog title={t('player.googleRequired.title')} onClose={dismiss}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {block === MusicError.GoogleSessionExpired
            ? t('player.googleRequired.expired')
            : t('player.googleRequired.notLinked')}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            onClick={() => {
              dismiss();
              void navigate({ to: '/profile' });
            }}
          >
            {t('player.googleRequired.link')}
          </Button>
          <Button variant={ButtonVariant.Ghost} onClick={dismiss}>
            {t('player.googleRequired.later')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
