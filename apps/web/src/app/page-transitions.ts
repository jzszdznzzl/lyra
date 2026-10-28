import { isMotionReduced } from './motion.ts';

/**
 * Whether a navigation gets the page animation. Overlays (player, dialogs, menus) add history
 * entries with the same path, and the search page rewrites its query while typing: animating
 * those would flash a snapshot of the page over whatever is open.
 */
export function pageTransition({ pathChanged }: { pathChanged: boolean }): string[] | false {
  return pathChanged && !isMotionReduced() ? ['page'] : false;
}
