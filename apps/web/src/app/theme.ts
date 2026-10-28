export const Theme = Object.freeze({
  Dark: 'dark',
  Light: 'light',
  System: 'system',
} as const);

export type Theme = (typeof Theme)[keyof typeof Theme];

const STORAGE_KEY = 'lyra.theme';

function resolve(theme: Theme): Exclude<Theme, 'system'> {
  if (theme !== Theme.System) {
    return theme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? Theme.Light : Theme.Dark;
}

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return Object.values(Theme).find((theme) => theme === stored) ?? Theme.Dark;
  } catch {
    return Theme.Dark;
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset['theme'] = resolve(theme);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies to this tab.
  }
}
