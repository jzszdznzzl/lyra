import { useEffect } from 'react';

const APP_NAME = 'Lyra';

/** "Album name · Lyra" in the tab and the task switcher; just "Lyra" without a title. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
