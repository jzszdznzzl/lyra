interface BarStripProps {
  values: readonly number[];
  // Text under each bar; an empty string leaves that slot unlabelled.
  labels: readonly string[];
  // What a bar means, for its tooltip and the screen reader table: "March: 12 plays".
  describe: (index: number, value: number) => string;
  highlight: number | null;
  className?: string;
}

/**
 * One series of bars: thin, rounded at the top, anchored to the baseline. Each bar shows its
 * value on hover or focus, and a visually hidden list carries the same data.
 */
export function BarStrip({ values, labels, describe, highlight, className = '' }: BarStripProps) {
  const max = Math.max(1, ...values);

  return (
    <figure className={className}>
      <div className="flex h-32 items-end gap-0.5 border-b border-line" aria-hidden="true">
        {values.map((value, index) => (
          <div key={index} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              title={describe(index, value)}
              className={`w-full max-w-6 rounded-t transition ${index === highlight ? 'bg-accent' : 'bg-accent/40 group-hover:bg-accent/70'}`}
              style={{ height: value === 0 ? 0 : `max(4px, ${(value / max) * 100}%)` }}
            />
            <span className="pointer-events-none absolute bottom-full mb-1 hidden rounded-md bg-text px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-bg group-hover:block">
              {describe(index, value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 text-[10px] text-muted" aria-hidden="true">
        {labels.map((label, index) => (
          <span key={index} className="flex-1 text-center">
            {label}
          </span>
        ))}
      </div>
      <ul className="sr-only">
        {values.map((value, index) => (
          <li key={index}>{describe(index, value)}</li>
        ))}
      </ul>
    </figure>
  );
}
