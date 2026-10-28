import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LANGUAGE, Language } from '@lyra/shared';

import en from './en.json';
import es from './es.json';

const STORAGE_KEY = 'lyra.language';

export const resources = {
  [Language.English]: { translation: en },
  [Language.Spanish]: { translation: es },
} as const;

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const match = Object.values(Language).find((language) => language === stored);

    return match ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export async function initI18n(language: Language = readStoredLanguage()) {
  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
  });

  return i18n;
}

export async function changeLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be blocked; the change still applies to this tab.
  }

  await i18n.changeLanguage(language);
}
