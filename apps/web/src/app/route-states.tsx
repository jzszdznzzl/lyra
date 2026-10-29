import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../lib/use-document-title.ts';
import { useHideBootSplash } from './boot-splash.ts';
import { Page } from '../ui/page.tsx';

export function NotFoundPage() {
  const { t } = useTranslation();
  useHideBootSplash();
  useDocumentTitle(t('states.notFound'));

  return (
    <Page>
      <div className="flex flex-col items-start gap-3 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('states.notFound')}</h1>
        <p className="text-muted">{t('states.notFoundBody')}</p>
        <Link to="/" className="font-bold text-accent hover:underline">
          {t('states.goHome')}
        </Link>
      </div>
    </Page>
  );
}

export function CrashPage() {
  const { t } = useTranslation();
  useHideBootSplash();
  useDocumentTitle(t('states.crash'));

  return (
    <Page>
      <div className="flex flex-col items-start gap-3 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('states.crash')}</h1>
        <p className="text-muted">{t('states.crashBody')}</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="font-bold text-accent hover:underline"
        >
          {t('states.reload')}
        </button>
      </div>
    </Page>
  );
}
