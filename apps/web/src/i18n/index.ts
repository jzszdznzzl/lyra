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

/** The first of the browser's languages that Lyra speaks ("es-CL" → "es"). */
export function browserLanguage(preferred: readonly string[] = navigator.languages) {
  for (const tag of preferred) {
    const match = Object.values(Language).find(
      (language) => language === tag.toLowerCase().split('-')[0],
    );

    if (match) {
      return match;
    }
  }

  return null;
}

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const match = Object.values(Language).find((language) => language === stored);

    // Before signing in, the browser's language: the page then never looks foreign to it.
    return match ?? browserLanguage() ?? DEFAULT_LANGUAGE;
  } catch {
    return browserLanguage() ?? DEFAULT_LANGUAGE;
  }
}

export async function initI18n(language: Language = readStoredLanguage()) {
  // Screen readers, hyphenation and the browser's translate offer all read <html lang>.
  i18n.on('languageChanged', (current) => {
    document.documentElement.lang = current;
  });
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
