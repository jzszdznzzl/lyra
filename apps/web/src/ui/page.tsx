import type { ReactNode } from 'react';

/** Side and bottom spacing shared by every page inside the main panel. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col px-4 pb-8 sm:px-7">{children}</div>;
}
