export const Theme = Object.freeze({
  Dark: 'dark',
  Light: 'light',
  System: 'system',
} as const);

export type Theme = (typeof Theme)[keyof typeof Theme];

const STORAGE_KEY = 'lyra.theme';
const THEME_COLORS = { [Theme.Dark]: '#0b0a0f', [Theme.Light]: '#f7f3f5' } as const;

function resolve(theme: Theme): Exclude<Theme, 'system'> {
  if (theme !== Theme.System) {
    return theme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? Theme.Light : Theme.Dark;
}

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    // Following the device is what people expect until they pick a theme themselves.
    return Object.values(Theme).find((theme) => theme === stored) ?? Theme.System;
  } catch {
    return Theme.System;
  }
}

export function applyTheme(theme: Theme) {
  const resolved = resolve(theme);
  document.documentElement.dataset['theme'] = resolved;
  // The status bar of the installed app follows the theme too.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[resolved]);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies to this tab.
  }
}

/** With "system", follow the OS switching between light and dark while the app is open. */
export function followSystemTheme() {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (readStoredTheme() === Theme.System) {
      applyTheme(Theme.System);
    }
  });
}
