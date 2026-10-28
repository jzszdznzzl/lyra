import { useTranslation } from 'react-i18next';

import { ApiFailure } from '../../lib/api.ts';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { useErrorText } from '../auth/use-error-text.ts';

export function LoadingState() {
  return (
    <div className="grid place-items-center py-24">
      <span className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const message = error instanceof ApiFailure ? errorText(error.code) : t('music.loadFailed');

  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <Notice tone={NoticeTone.Error}>{message}</Notice>
      <Button variant={ButtonVariant.Secondary} onClick={onRetry}>
        {t('music.retry')}
      </Button>
    </div>
  );
}
