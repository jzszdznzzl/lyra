import { useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { UpdateProfileInput, UserProfile } from '@lyra/shared';

import { copyText } from '../../lib/clipboard.ts';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { useToast } from '../../ui/toast.tsx';
import { Toggle } from '../../ui/toggle.tsx';
import { meQuery, updateProfile } from '../auth/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { Section } from './section.tsx';
import type { ApiError } from '../../lib/api.ts';

const WidgetTheme = Object.freeze({ Dark: 'dark', Light: 'light' } as const);

type WidgetTheme = (typeof WidgetTheme)[keyof typeof WidgetTheme];

export function ListeningSection({ me }: { me: UserProfile }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const showToast = useToast((state) => state.show);
  const [theme, setTheme] = useState<WidgetTheme>(WidgetTheme.Dark);
  const [error, setError] = useState<ApiError | null>(null);
  const widgetUrl = `${window.location.origin}/api/u/${me.username}/now-playing.svg?theme=${theme}`;
  const jsonUrl = `${window.location.origin}/api/u/${me.username}/now-playing.json`;
  const markdown = `[![${t('profile.listening.widgetAlt')}](${widgetUrl})](${window.location.origin})`;

  async function save(patch: UpdateProfileInput) {
    const result = await updateProfile(patch);
    setError(result.error);

    if (result.data) {
      queryClient.setQueryData(meQuery.queryKey, result.data);
    }
  }

  async function copy(text: string) {
    showToast(
      t((await copyText(text)) ? 'profile.listening.copied' : 'profile.listening.copyFailed'),
    );
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
        <Toggle
          label={t('profile.listening.public')}
          hint={t('profile.listening.publicHint')}
          isOn={me.isNowPlayingPublic}
          onChange={(isOn) => void save({ isNowPlayingPublic: isOn })}
        />
        {me.isNowPlayingPublic ? (
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex gap-2">
              {Object.values(WidgetTheme).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={theme === option}
                  onClick={() => setTheme(option)}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted transition aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
                >
                  {t(`profile.theme.${option}`)}
                </button>
              ))}
            </div>
            <img
              src={widgetUrl}
              alt={t('profile.listening.widgetAlt')}
              width={400}
              height={104}
              className="h-auto w-full max-w-[400px]"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant={ButtonVariant.Secondary} onClick={() => void copy(markdown)}>
                <Copy className="size-4" />
                {t('profile.listening.copyMarkdown')}
              </Button>
              <Button variant={ButtonVariant.Ghost} onClick={() => void copy(widgetUrl)}>
                <Copy className="size-4" />
                {t('profile.listening.copyImage')}
              </Button>
              <Button variant={ButtonVariant.Ghost} onClick={() => void copy(jsonUrl)}>
                <Copy className="size-4" />
                {t('profile.listening.copyJson')}
              </Button>
            </div>
            <p className="text-xs text-muted">{t('profile.listening.cacheNote')}</p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
