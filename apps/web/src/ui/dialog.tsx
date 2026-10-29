import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useBackToClose } from '../lib/use-back-to-close.ts';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ title, onClose, children }: DialogProps) {
  const { t } = useTranslation();
  useBackToClose(true, onClose);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portaled to <body>: blurred ancestors (backdrop-filter) would otherwise trap `fixed`.
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-black/60 p-3 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
      // Handled here too: a portal's keys still bubble through its React parents, and a parent
      // that stops them (a track row) would keep Escape from reaching the window listener.
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[96dvh] w-full max-w-md animate-pop flex-col gap-4 overflow-y-auto rounded-3xl border border-line bg-bg p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-text"
          >
            <X className="size-5" />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
