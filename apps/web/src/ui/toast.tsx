import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (message: string) => void;
  clear: () => void;
}

const TOAST_MS = 2500;

export const useToast = create<ToastState>()((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}));

export function Toaster() {
  const message = useToast((state) => state.message);
  const clear = useToast((state) => state.clear);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(clear, TOAST_MS);

    return () => clearTimeout(timer);
  }, [message, clear]);

  if (!message) {
    return null;
  }

  return createPortal(
    <div role="status" className="fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4">
      <p className="rounded-full bg-text px-5 py-2.5 text-sm font-semibold text-bg shadow-2xl">
        {message}
      </p>
    </div>,
    document.body,
  );
}
