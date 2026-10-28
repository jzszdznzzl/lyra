export const Motion = Object.freeze({
  System: 'system',
  On: 'on',
  Off: 'off',
} as const);

export type Motion = (typeof Motion)[keyof typeof Motion];

const STORAGE_KEY = 'lyra.motion';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
// Read by styles.css: "reduced" stops transitions and animations everywhere in the app.
const REDUCED = 'reduced';
const FULL = 'full';

function isOsReduced() {
  return window.matchMedia(REDUCED_QUERY).matches;
}

export function readStoredMotion(): Motion {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    // Following the device respects people who asked their OS for less motion.
    return Object.values(Motion).find((motion) => motion === stored) ?? Motion.System;
  } catch {
    return Motion.System;
  }
}

export function applyMotion(motion: Motion) {
  const isReduced = motion === Motion.Off || (motion === Motion.System && isOsReduced());
  document.documentElement.dataset['motion'] = isReduced ? REDUCED : FULL;

  try {
    localStorage.setItem(STORAGE_KEY, motion);
  } catch {
    // Storage can be blocked; the choice still applies to this tab.
  }
}

/** For animations started from code (smooth scrolling), which CSS cannot turn off. */
export function isMotionReduced() {
  return document.documentElement.dataset['motion'] === REDUCED;
}

/** With "system", follow the OS setting changing while the app is open. */
export function followSystemMotion() {
  window.matchMedia(REDUCED_QUERY).addEventListener('change', () => {
    if (readStoredMotion() === Motion.System) {
      applyMotion(Motion.System);
    }
  });
}
