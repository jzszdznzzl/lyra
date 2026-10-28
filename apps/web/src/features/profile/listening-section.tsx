import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { UpdateProfileInput, UserProfile } from '@lyra/shared';

import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { Toggle } from '../../ui/toggle.tsx';
import { meQuery, updateProfile } from '../auth/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { Section } from './section.tsx';
import type { ApiError } from '../../lib/api.ts';

export function ListeningSection({ me }: { me: UserProfile }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [error, setError] = useState<ApiError | null>(null);

  async function save(patch: UpdateProfileInput) {
    const result = await updateProfile(patch);
    setError(result.error);

    if (result.data) {
      queryClient.setQueryData(meQuery.queryKey, result.data);
    }
  }

  return (
    <Section title={t('profile.listening.title')}>
      <div className="flex flex-col gap-5">
        {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
        <Toggle
          label={t('profile.listening.history')}
          hint={t(
            me.isGoogleLinked
              ? 'profile.listening.historyHint'
              : 'profile.listening.historyNeedsGoogle',
          )}
          isOn={me.isGoogleLinked && me.isYoutubeHistoryEnabled}
          isDisabled={!me.isGoogleLinked}
          onChange={(isOn) => void save({ isYoutubeHistoryEnabled: isOn })}
        />
      </div>
    </Section>
  );
}
