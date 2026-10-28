import { usePlayerStore } from '../features/player/player-store.ts';
import { useUiStore } from '../features/player/ui-store.ts';

const SEEK_STEP_SECONDS = 10;
const EDITABLE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];
// Space and arrows already mean something on these; only F is safe there.
const INTERACTIVE_TAGS = ['BUTTON', 'A', ...EDITABLE_TAGS];

/** Player shortcuts: Space play/pause, ←/→ seek 10 s, F full screen. Never while typing. */
export function handleShortcut(event: KeyboardEvent) {
  const target = event.target;

  if (event.ctrlKey || event.metaKey || event.altKey || !(target instanceof HTMLElement)) {
    return;
  }

  if (target.isContentEditable || EDITABLE_TAGS.includes(target.tagName)) {
    return;
  }

  const isOnControl =
    INTERACTIVE_TAGS.includes(target.tagName) || target.getAttribute('role') === 'slider';
  const player = usePlayerStore.getState();

  switch (event.key) {
    case 'f':
    case 'F': {
      const ui = useUiStore.getState();

      if (ui.immersive) {
        ui.closeImmersive();
      } else {
        ui.openImmersive();
      }

      break;
    }
    case ' ': {
      if (!isOnControl && player.queue.length > 0) {
        event.preventDefault();
        player.togglePlay();
      }

      break;
    }
    case 'ArrowRight':
    case 'ArrowLeft': {
      if (!isOnControl && player.duration > 0) {
        event.preventDefault();
        const step = event.key === 'ArrowRight' ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS;
        player.seek(Math.min(player.duration, Math.max(0, player.position + step)));
      }

      break;
    }
    default: {
      break;
    }
  }
}
