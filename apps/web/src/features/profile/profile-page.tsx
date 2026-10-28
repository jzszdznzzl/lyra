import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '../../lib/use-document-title.ts';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { logout, meQuery } from '../auth/api.ts';
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
        <Button variant={ButtonVariant.Ghost} onClick={() => void signOut()}>
          <LogOut className="size-4" />
          {t('profile.signOut')}
        </Button>
      </div>
      <DetailsSection me={me} />
      <GoogleSection me={me} />
      <ListeningSection me={me} />
      <AppearanceSection />
      <PasswordSection me={me} />
      <PasskeysSection />
      <SessionsSection />
      <ApiTokensSection />
      <DeleteAccountSection />
    </div>
  );
}
