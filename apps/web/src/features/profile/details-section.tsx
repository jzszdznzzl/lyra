import { useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { AVATAR_MAX_BYTES, Language } from '@lyra/shared';
import type { UserProfile } from '@lyra/shared';

import { changeLanguage } from '../../i18n/index.ts';
import { ApiError } from '../../lib/api.ts';
import { Avatar } from '../../ui/avatar.tsx';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { meQuery, removeAvatar, updateProfile, uploadAvatar } from '../auth/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { Section } from './section.tsx';

const LANGUAGE_LABELS: Record<Language, string> = {
  [Language.English]: 'English',
  [Language.Spanish]: 'Español',
};

export function DetailsSection({ me }: { me: UserProfile }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me.name);
  const [isBusy, setIsBusy] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  function apply(profile: UserProfile) {
    queryClient.setQueryData(meQuery.queryKey, profile);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await updateProfile({ name });
    setIsBusy(false);
    setError(result.error);
    setIsSaved(result.error === null);

    if (result.data) {
      apply(result.data);
    }
  }

  async function pickLanguage(language: Language) {
    await changeLanguage(language);
    const result = await updateProfile({ language });

    if (result.data) {
      apply(result.data);
    }
  }

  async function upload(file: File) {
    if (file.size > AVATAR_MAX_BYTES) {
      setError(ApiError.InvalidImage);

      return;
    }

    const result = await uploadAvatar(file);
    setError(result.error);

    if (result.data) {
      apply(result.data);
    }
  }

  async function remove() {
    const result = await removeAvatar();

    if (result.data) {
      apply(result.data);
    }
  }

  return (
    <Section title={t('profile.details.title')}>
      <form className="flex flex-col gap-5" onSubmit={(event) => void save(event)}>
        <div className="flex items-center gap-5">
          <button
            type="button"
            className="group relative rounded-full"
            onClick={() => fileInput.current?.click()}
            aria-label={t('profile.avatar.change')}
          >
            <Avatar name={me.name} url={me.avatarUrl} size={88} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
              <Camera className="size-6 text-white" />
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';

              if (file) {
                void upload(file);
              }
            }}
          />
          <div className="flex flex-col gap-1">
            <span className="text-lg font-bold">{me.name}</span>
            <span className="text-sm text-muted">
              @{me.username} · {me.email}
            </span>
            {me.avatarUrl ? (
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1.5 self-start text-xs font-bold text-muted hover:text-red-400"
                onClick={() => void remove()}
              >
                <Trash2 className="size-3.5" />
                {t('profile.avatar.remove')}
              </button>
            ) : null}
          </div>
        </div>
        {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
        {isSaved ? <Notice tone={NoticeTone.Success}>{t('profile.details.saved')}</Notice> : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <TextField
            label={t('auth.name')}
            required
            maxLength={60}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setIsSaved(false);
            }}
          />
          <Button
            type="submit"
            variant={ButtonVariant.Secondary}
            isBusy={isBusy}
            disabled={name.trim() === me.name}
          >
            {t('profile.details.save')}
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wider text-muted uppercase">
            {t('profile.language')}
          </span>
          <div className="flex gap-2">
            {Object.values(Language).map((language) => (
              <button
                key={language}
                type="button"
                aria-pressed={me.language === language}
                onClick={() => void pickLanguage(language)}
                className="rounded-full border border-line px-4 py-2 text-sm font-bold text-muted transition aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
              >
                {LANGUAGE_LABELS[language]}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Section>
  );
}
