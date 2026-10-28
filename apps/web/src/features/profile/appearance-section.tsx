import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Motion, applyMotion, readStoredMotion } from '../../app/motion.ts';
import { Theme, applyTheme, readStoredTheme } from '../../app/theme.ts';
import { Section } from './section.tsx';

const OPTION_CLASSES =
  'rounded-full border border-line px-4 py-2 text-sm font-bold text-muted transition aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg';

export function AppearanceSection() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(readStoredTheme);
  const [motion, setMotion] = useState(readStoredMotion);

  return (
    <Section title={t('profile.theme.title')}>
      <div className="flex flex-col gap-5">
        <div className="flex gap-2">
          {Object.values(Theme).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => {
                applyTheme(option);
                setTheme(option);
              }}
              className={OPTION_CLASSES}
            >
              {t(`profile.theme.${option}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">{t('profile.motion.title')}</h3>
          <p className="text-xs text-muted">{t('profile.motion.hint')}</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(Motion).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={motion === option}
                onClick={() => {
                  applyMotion(option);
                  setMotion(option);
                }}
                className={OPTION_CLASSES}
              >
                {t(`profile.motion.${option}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
