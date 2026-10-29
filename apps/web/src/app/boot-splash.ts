import { useEffect } from 'react';

const SPLASH_ID = 'boot-splash';
// Whatever happens (a stuck request, an unexpected screen), the loading screen does not stay up.
const MAX_SPLASH_MS = 10_000;

/**
 * Removes the loading screen from index.html. It lives outside the React root, so it stays up
 * while the app finds out whether someone is signed in, instead of flashing an empty page.
 */
export function hideBootSplash() {
  document.getElementById(SPLASH_ID)?.remove();
}

export function hideBootSplashLater() {
  setTimeout(hideBootSplash, MAX_SPLASH_MS);
}

/** For the first screens a load can land on: the app, the sign-in pages and error pages. */
export function useHideBootSplash() {
  useEffect(hideBootSplash, []);
}
