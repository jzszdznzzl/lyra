import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { Toggle } from '../../ui/toggle.tsx';
import {
  PushSupport,
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
} from '../notifications/push.ts';
import { Section } from './section.tsx';

const NOTICE_KEYS = {
  [PushSupport.Unsupported]: 'profile.notifications.unsupported',
  [PushSupport.NeedsInstall]: 'profile.notifications.needsInstall',
  [PushSupport.Denied]: 'profile.notifications.denied',
} as const;

export function NotificationsSection() {
  const { t } = useTranslation();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [isOn, setIsOn] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    void (async () => {
      const found = await pushSupport();
      const subscription = found === PushSupport.Ready ? await currentSubscription() : null;

      if (isCurrent) {
        setSupport(found);
        setIsOn(subscription !== null);
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, []);

  async function change(wanted: boolean) {
    setIsBusy(true);
    setHasFailed(false);

    try {
      if (wanted) {
        const isEnabled = await enablePush();
        setIsOn(isEnabled);
        setHasFailed(!isEnabled);
        setSupport(await pushSupport());
      } else {
        await disablePush();
        setIsOn(false);
      }
    } catch {
      setHasFailed(true);
    } finally {
      setIsBusy(false);
    }
  }

  // Nothing to offer on a server without push keys, or while checking.
  if (support === null || support === PushSupport.Off) {
    return null;
  }

  return (
    <Section title={t('profile.notifications.title')}>
      <div className="flex flex-col gap-4">
        <Toggle
          label={t('profile.notifications.toggle')}
          hint={t('profile.notifications.hint')}
          isOn={isOn}
          isDisabled={support !== PushSupport.Ready || isBusy}
          onChange={(wanted) => void change(wanted)}
        />
        {support !== PushSupport.Ready ? (
          <Notice tone={NoticeTone.Info}>{t(NOTICE_KEYS[support])}</Notice>
        ) : null}
        {hasFailed && support === PushSupport.Ready ? (
          <Notice tone={NoticeTone.Error}>{t('profile.notifications.failed')}</Notice>
        ) : null}
      </div>
    </Section>
  );
}
