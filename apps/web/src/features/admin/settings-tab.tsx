import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Save } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { FallbackStatus, SMTP_PASSWORD_MAX_LENGTH } from '@lyra/shared';
import type { AdminSettingsView, UpdateSettingsInput } from '@lyra/shared';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { Toggle } from '../../ui/toggle.tsx';
import { useToast } from '../../ui/toast.tsx';
import { configQuery } from '../auth/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { adminSettingsQuery, sendTestMail, updateSettings } from './api.ts';
import type { ApiError } from '../../lib/api.ts';

interface Draft {
  isRegistrationEnabled: boolean;
  streamFallbackUsername: string;
  mailFrom: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
}

// Mail delivery is chosen in the env file; only SMTP uses the fields below.
const SMTP_TRANSPORT = 'smtp';

const FALLBACK_TONES: Record<FallbackStatus, NoticeTone> = {
  [FallbackStatus.Off]: NoticeTone.Info,
  [FallbackStatus.Ready]: NoticeTone.Success,
  [FallbackStatus.UnknownUser]: NoticeTone.Error,
  [FallbackStatus.NotLinked]: NoticeTone.Error,
};

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl sm:p-6">
      <header>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Only what differs from the saved settings is sent, so untouched fields keep env defaults. */
function changes(saved: AdminSettingsView, draft: Draft): UpdateSettingsInput {
  const patch: UpdateSettingsInput = {};
  const fallback = draft.streamFallbackUsername.trim();

  if (draft.isRegistrationEnabled !== saved.isRegistrationEnabled) {
    patch.isRegistrationEnabled = draft.isRegistrationEnabled;
  }

  if (fallback !== (saved.streamFallbackUsername ?? '')) {
    patch.streamFallbackUsername = fallback === '' ? null : fallback;
  }

  if (draft.mailFrom.trim() !== saved.mailFrom) {
    patch.mailFrom = draft.mailFrom.trim();
  }

  if (draft.smtpHost.trim() !== saved.smtpHost) {
    patch.smtpHost = draft.smtpHost.trim();
  }

  if (Number(draft.smtpPort) !== saved.smtpPort) {
    patch.smtpPort = Number(draft.smtpPort);
  }

  if (draft.smtpUser.trim() !== saved.smtpUser) {
    patch.smtpUser = draft.smtpUser.trim();
  }

  if (draft.smtpPassword !== '') {
    patch.smtpPassword = draft.smtpPassword;
  }

  return patch;
}

function toDraft(saved: AdminSettingsView): Draft {
  return {
    isRegistrationEnabled: saved.isRegistrationEnabled,
    streamFallbackUsername: saved.streamFallbackUsername ?? '',
    mailFrom: saved.mailFrom,
    smtpHost: saved.smtpHost,
    smtpPort: String(saved.smtpPort),
    smtpUser: saved.smtpUser,
    smtpPassword: '',
  };
}

function SettingsForm({ saved }: { saved: AdminSettingsView }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const showToast = useToast((state) => state.show);
  const [draft, setDraft] = useState(() => toDraft(saved));
  const [isBusy, setIsBusy] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [mailResult, setMailResult] = useState<{ isSent: boolean; reason: string | null } | null>(
    null,
  );
  const patch = changes(saved, draft);
  const hasChanges = Object.keys(patch).length > 0;
  const set = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await updateSettings(patch);
    setIsBusy(false);
    setError(result.error);

    if (result.data) {
      queryClient.setQueryData(adminSettingsQuery.queryKey, result.data);
      await queryClient.invalidateQueries({ queryKey: configQuery.queryKey });
      setDraft(toDraft(result.data));
      showToast(t('admin.settings.saved'));
    }
  }

  async function testMail() {
    setIsTesting(true);
    setMailResult(await sendTestMail());
    setIsTesting(false);
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5">
      {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
      <Group title={t('admin.settings.accounts')}>
        <Toggle
          label={t('admin.settings.registration')}
          hint={t('admin.settings.registrationHint')}
          isOn={draft.isRegistrationEnabled}
          onChange={(isOn) => set({ isRegistrationEnabled: isOn })}
        />
      </Group>
      <Group title={t('admin.settings.playback')} hint={t('admin.settings.fallbackHint')}>
        <TextField
          label={t('admin.settings.fallback')}
          placeholder={t('admin.settings.fallbackPlaceholder')}
          value={draft.streamFallbackUsername}
          maxLength={20}
          autoComplete="off"
          onChange={(event) => set({ streamFallbackUsername: event.target.value.toLowerCase() })}
        />
        <Notice tone={FALLBACK_TONES[saved.fallbackStatus]}>
          {t(`admin.settings.fallbackStatus.${saved.fallbackStatus}`)}
        </Notice>
      </Group>
      <Group title={t('admin.settings.mail')} hint={t('admin.settings.mailHint')}>
        {saved.mailTransport === SMTP_TRANSPORT ? null : (
          <Notice tone={NoticeTone.Info}>
            {t('admin.settings.mailTransport', { transport: saved.mailTransport })}
          </Notice>
        )}
        <TextField
          label={t('admin.settings.mailFrom')}
          value={draft.mailFrom}
          maxLength={200}
          required
          onChange={(event) => set({ mailFrom: event.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <TextField
            label={t('admin.settings.smtpHost')}
            value={draft.smtpHost}
            maxLength={253}
            autoComplete="off"
            onChange={(event) => set({ smtpHost: event.target.value })}
          />
          <TextField
            label={t('admin.settings.smtpPort')}
            type="number"
            min={1}
            max={65_535}
            value={draft.smtpPort}
            onChange={(event) => set({ smtpPort: event.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('admin.settings.smtpUser')}
            value={draft.smtpUser}
            maxLength={254}
            autoComplete="off"
            onChange={(event) => set({ smtpUser: event.target.value })}
          />
          <TextField
            label={t('admin.settings.smtpPassword')}
            type="password"
            autoComplete="new-password"
            maxLength={SMTP_PASSWORD_MAX_LENGTH}
            placeholder={
              saved.hasSmtpPassword
                ? t('admin.settings.passwordKept')
                : t('admin.settings.passwordNone')
            }
            value={draft.smtpPassword}
            onChange={(event) => set({ smtpPassword: event.target.value })}
          />
        </div>
        {mailResult ? (
          <Notice tone={mailResult.isSent ? NoticeTone.Success : NoticeTone.Error}>
            {mailResult.isSent
              ? t('admin.settings.testSent')
              : t('admin.settings.testFailed', { reason: mailResult.reason ?? '—' })}
          </Notice>
        ) : null}
        <Button
          variant={ButtonVariant.Secondary}
          className="self-start"
          isBusy={isTesting}
          disabled={hasChanges}
          title={hasChanges ? t('admin.settings.saveFirst') : undefined}
          onClick={() => void testMail()}
        >
          <Mail className="size-4" />
          {t('admin.settings.testMail')}
        </Button>
      </Group>
      <div className="sticky bottom-0 flex justify-end rounded-2xl py-2">
        <Button type="submit" isBusy={isBusy} disabled={!hasChanges}>
          <Save className="size-4" />
          {t('admin.settings.save')}
        </Button>
      </div>
    </form>
  );
}

export function SettingsTab() {
  const settings = useQuery(adminSettingsQuery);

  return settings.data ? <SettingsForm saved={settings.data} /> : null;
}
