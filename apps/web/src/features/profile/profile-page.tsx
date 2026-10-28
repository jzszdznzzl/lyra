import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Crown, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { logout, meQuery } from '../auth/api.ts';
import { AboutSection } from './about-section.tsx';
import { ApiTokensSection } from './api-tokens-section.tsx';
import { AppearanceSection } from './appearance-section.tsx';
import { DeleteAccountSection } from './delete-account-section.tsx';
import { DetailsSection } from './details-section.tsx';
import { GoogleSection } from './google-section.tsx';
import { ListeningSection } from './listening-section.tsx';
import { PasskeysSection } from './passkeys-section.tsx';
import { PasswordSection } from './password-section.tsx';
import { SessionsSection } from './sessions-section.tsx';

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  useDocumentTitle(t('profile.title'));

  async function signOut() {
    await logout();
    queryClient.clear();
    await navigate({ to: '/login' });
  }

  if (!me) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-7">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('profile.title')}</h1>
        <div className="flex items-center gap-1">
          {me.isAdmin ? (
            <Link
              to="/admin"
              className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-muted transition hover:bg-surface hover:text-text"
            >
              <Crown className="size-4 text-amber-500" />
              {t('profile.adminPanel')}
            </Link>
          ) : null}
          <Button variant={ButtonVariant.Ghost} onClick={() => void signOut()}>
            <LogOut className="size-4" />
            {t('profile.signOut')}
          </Button>
        </div>
      </div>
      <DetailsSection me={me} />
      <GoogleSection me={me} />
      <ListeningSection me={me} />
      <AppearanceSection />
      <PasswordSection me={me} />
      <PasskeysSection />
      <SessionsSection />
      <ApiTokensSection />
      <AboutSection />
      <DeleteAccountSection />
    </div>
  );
}
