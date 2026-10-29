import { Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useHideBootSplash } from '../../app/boot-splash.ts';
import { useDocumentTitle } from '../../lib/use-document-title.ts';
import { Brand } from '../../ui/brand.tsx';

export function AuthLayout() {
  const { t } = useTranslation();
  useDocumentTitle(null);
  useHideBootSplash();

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex animate-fade-up flex-col items-center gap-3 text-center">
          <Brand />
          <p className="text-sm text-muted">{t('app.tagline')}</p>
        </div>
        <div className="animate-fade-up rounded-3xl border border-line bg-panel p-7 shadow-2xl shadow-black/30 backdrop-blur-2xl [animation-delay:80ms]">
          {/* Moving between sign-in and sign-up fades the form like pages in the app. */}
          <div className="[view-transition-name:page]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
