import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Theme, applyTheme, readStoredTheme } from '../../app/theme.ts';
import { Section } from './section.tsx';

export function AppearanceSection() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(readStoredTheme);

  return (
    <Section title={t('profile.theme.title')}>
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
            className="rounded-full border border-line px-4 py-2 text-sm font-bold text-muted transition aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
          >
            {t(`profile.theme.${option}`)}
          </button>
        ))}
      </div>
    </Section>
  );
}
