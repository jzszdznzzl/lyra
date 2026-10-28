import { useTranslation } from 'react-i18next';

import type { UserProfile } from '@lyra/shared';

import { Button } from '../../ui/button.tsx';
import { Section } from './section.tsx';

export function GoogleSection({ me }: { me: UserProfile }) {
  const { t } = useTranslation();

  return (
    <Section
      title={t('profile.google.title')}
      description={t('profile.google.body')}
      aside={
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${me.isGoogleLinked ? 'bg-emerald-400/15 text-emerald-400' : 'bg-surface-2 text-muted'}`}
        >
          {me.isGoogleLinked ? t('profile.google.linked') : t('profile.google.notLinked')}
        </span>
      }
    >
      <Button disabled>{t('profile.google.link')}</Button>
    </Section>
  );
}
