import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function Section({ title, description, aside, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-6 backdrop-blur-2xl">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}
