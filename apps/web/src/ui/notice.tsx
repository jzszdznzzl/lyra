import type { ReactNode } from 'react';

export const NoticeTone = Object.freeze({
  Error: 'error',
  Success: 'success',
  Info: 'info',
} as const);

export type NoticeTone = (typeof NoticeTone)[keyof typeof NoticeTone];

const TONE_CLASSES: Record<NoticeTone, string> = {
  [NoticeTone.Error]: 'border-red-400/40 bg-red-400/10 text-red-300',
  [NoticeTone.Success]: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  [NoticeTone.Info]: 'border-line bg-surface text-muted',
};

export function Notice({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  return (
    <div
      role={tone === NoticeTone.Error ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${TONE_CLASSES[tone]}`}
    >
      {children}
    </div>
  );
}
