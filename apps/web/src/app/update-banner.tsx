import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { applyUpdate, useUpdateStore } from './updates.ts';

/** Shown while a new version waits for the song to pause; one tap switches right away. */
export function UpdateBanner() {
  const { t } = useTranslation();
  const isReady = useUpdateStore((state) => state.isReady);

  if (!isReady) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex animate-slide-down items-center gap-3 rounded-full border border-line bg-bg/90 py-1.5 pr-1.5 pl-4 text-sm shadow-2xl backdrop-blur"
      >
        <Sparkles className="size-4 text-accent" />
        {t('app.update.ready')}
        <button
          type="button"
          onClick={applyUpdate}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white"
        >
          {t('app.update.apply')}
        </button>
      </div>
    </div>
  );
}
