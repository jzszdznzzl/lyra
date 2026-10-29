import { OpenPathMessage } from '../sw-messages.ts';

/** Follows tapped notifications while the app is open (see openFromNotification in sw.ts). */
export function followNotificationLinks(open: (path: string) => void) {
  navigator.serviceWorker?.addEventListener('message', (event: MessageEvent<unknown>) => {
    const message = OpenPathMessage.safeParse(event.data);

    if (message.success) {
      open(message.data.path);
    }
  });
}
