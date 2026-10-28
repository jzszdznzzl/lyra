import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useToast } from '../../ui/toast.tsx';
import { ShareOutcome, shareLink } from './share.ts';
import type { ShareKind } from './share.ts';

export function useShare() {
  const { t } = useTranslation();
  const showToast = useToast((state) => state.show);

  return async (kind: ShareKind, id: string, title: string) => {
    const outcome = await shareLink(kind, id, title);

    if (outcome === ShareOutcome.Copied) {
      showToast(t('share.copied'));
    } else if (outcome === ShareOutcome.Failed) {
      showToast(t('share.failed'));
    }
  };
}

export function ShareButton({ kind, id, title }: { kind: ShareKind; id: string; title: string }) {
  const { t } = useTranslation();
  const share = useShare();

  return (
    <button
      type="button"
      aria-label={t('share.action')}
      title={t('share.action')}
      onClick={() => void share(kind, id, title)}
      className="grid size-11 place-items-center rounded-full border border-line text-muted hover:text-text"
    >
      <Share2 className="size-5" />
    </button>
  );
}
