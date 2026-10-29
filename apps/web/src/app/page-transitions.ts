import { isMotionReduced } from './motion.ts';

/**
 * Whether a navigation gets the page animation. Overlays (player, dialogs, menus) add history
 * entries with the same path, and the search page rewrites its query while typing: animating
 * those would flash a snapshot of the page over whatever is open.
 */
export function pageTransition({
  fromLocation,
  pathChanged,
}: {
  fromLocation?: unknown;
  pathChanged: boolean;
}): string[] | false {
  // The first page of a load has nothing to fade from, and its snapshot would be drawn over the
  // opening animation (view transitions paint above everything else).
  return fromLocation !== undefined && pathChanged && !isMotionReduced() ? ['page'] : false;
}
