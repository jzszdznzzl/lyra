import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function isInstallPrompt(event: Event): event is InstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function';
}

/** Chrome's "install app" prompt, kept until the user asks for it; null when not offered. */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      if (isInstallPrompt(event)) {
        event.preventDefault();
        setPrompt(event);
      }
    };
    const onInstalled = () => setPrompt(null);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return prompt ? () => void prompt.prompt().then(() => setPrompt(null)) : null;
}
