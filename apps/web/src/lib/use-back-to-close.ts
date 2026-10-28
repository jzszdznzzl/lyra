import { useEffect, useRef, useState } from 'react';

const STATE_KEY = 'lyraOverlay';

// Closes waiting one tick, so React StrictMode's unmount-remount does not pop the entry.
const pendingCloses = new Map<string, ReturnType<typeof setTimeout>>();

function isOwnEntry(id: string) {
  const state: unknown = history.state;

  return (
    typeof state === 'object' && state !== null && STATE_KEY in state && state[STATE_KEY] === id
  );
}

/**
 * Gives an overlay its own history entry, so Android's back gesture closes it instead of
 * leaving the page. Closing it any other way removes that entry again.
 */
export function useBackToClose(isOpen: boolean, onClose: () => void) {
  const [id] = useState(() => crypto.randomUUID());
  const latestClose = useRef(onClose);

  useEffect(() => {
    latestClose.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const pending = pendingCloses.get(id);

    const current: unknown = history.state;
    const entry = { ...(typeof current === 'object' ? current : {}), [STATE_KEY]: id };
    // An overlay closing in this same tick (one dialog swapped for another) still owns the top
    // entry; taking it over avoids leaving it behind, where "back" would close the overlay below.
    const swapped = [...pendingCloses].find(([closingId]) => isOwnEntry(closingId));

    if (pending) {
      clearTimeout(pending);
      pendingCloses.delete(id);
    } else if (swapped) {
      clearTimeout(swapped[1]);
      pendingCloses.delete(swapped[0]);
      history.replaceState(entry, '');
    } else {
      // Same URL, so the router sees no navigation; only the history stack grows.
      history.pushState(entry, '');
    }

    let wasPopped = false;
    const onPop = () => {
      if (!isOwnEntry(id)) {
        wasPopped = true;
        latestClose.current();
      }
    };

    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);

      if (wasPopped) {
        return;
      }

      pendingCloses.set(
        id,
        setTimeout(() => {
          pendingCloses.delete(id);

          if (isOwnEntry(id)) {
            history.back();
          }
        }, 0),
      );
    };
  }, [isOpen, id]);
}
