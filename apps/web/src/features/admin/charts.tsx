import { useState } from 'react';

export interface ColumnPoint {
  key: string;
  // Short axis label ("28", "14 h"); only a few are shown under the chart.
  label: string;
  // Full name for the tooltip ("28 Oct").
  title: string;
  value: number;
}

export interface ShareSlice {
  key: string;
  label: string;
  value: number;
  // A CSS color, e.g. var(--chart-1).
  color: string;
}

export interface RankedRow {
  key: string;
  label: string;
  detail?: string;
  value: number;
}

const COLUMN_HEIGHT_PX = 160;
// Labels under the chart: first, a few in between and last, never one per column.
const AXIS_LABELS = 5;

function niceMax(value: number) {
  if (value <= 4) {
    return 4;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= value) ?? 10;

  return step * magnitude;
}

function compact(value: number, language: string) {
  return new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

/** One series over time or hours: accent columns from a shared baseline, tooltip per column. */
export function ColumnChart({
  points,
  language,
  label,
}: {
  points: ColumnPoint[];
  language: string;
  label: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...points.map((point) => point.value)));
  const every = Math.max(1, Math.ceil(points.length / AXIS_LABELS));
  const active = hovered === null ? null : (points[hovered] ?? null);

  return (
    <figure aria-label={label} className="flex flex-col gap-1.5">
      {/* A fixed readout line instead of a floating tooltip: it never covers the title or bars. */}
      <p role="status" className="ml-10 h-5 text-xs text-muted">
        {active ? (
          <>
            <strong className="text-sm text-text tabular-nums">
              {active.value.toLocaleString(language)}
            </strong>{' '}
            · {active.title}
          </>
        ) : null}
      </p>
      <div className="relative flex gap-2">
        <div
          aria-hidden
          className="flex w-8 shrink-0 flex-col justify-between text-right text-[11px] text-muted tabular-nums"
          style={{ height: COLUMN_HEIGHT_PX }}
        >
          <span className="-translate-y-1/2">{compact(max, language)}</span>
          <span className="-translate-y-1/2">{compact(max / 2, language)}</span>
          <span className="translate-y-1/2">0</span>
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: COLUMN_HEIGHT_PX }}>
          <div aria-hidden className="absolute inset-x-0 top-0 border-t border-line" />
          <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-line" />
          <div className="absolute inset-0 flex items-end gap-[2px] border-b border-line">
            {points.map((point, index) => (
              <button
                key={point.key}
                type="button"
                aria-label={`${point.title}: ${point.value}`}
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                className="group flex h-full min-w-0 flex-1 items-end justify-center outline-none"
              >
                <span
                  className="block w-full max-w-6 rounded-t-[4px] bg-accent transition group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-accent/40"
                  style={{
                    height: `${(point.value / max) * 100}%`,
                    minHeight: point.value > 0 ? 2 : 0,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className="ml-10 flex text-[11px] text-muted">
        {points.map((point, index) => (
          <span key={point.key} className="min-w-0 flex-1 text-center">
            {index % every === 0 || index === points.length - 1 ? point.label : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Part-to-whole of a few categories: one stacked bar plus a legend with every value. */
export function ShareBar({
  slices,
  language,
  label,
}: {
  slices: ShareSlice[];
  language: string;
  label: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const percent = (value: number) =>
    new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(
      total === 0 ? 0 : value / total,
    );

  return (
    <figure aria-label={label} className="flex flex-col gap-3">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-surface-2">
        {total > 0
          ? slices
              .filter((slice) => slice.value > 0)
              .map((slice) => (
                <span
                  key={slice.key}
                  title={`${slice.label}: ${slice.value}`}
                  style={{ flexGrow: slice.value, background: slice.color }}
                />
              ))
          : null}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: slice.color }} />
            <span className="text-muted">{slice.label}</span>
            <strong className="tabular-nums">{slice.value.toLocaleString(language)}</strong>
            <span className="text-xs text-muted tabular-nums">{percent(slice.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** A ranking: name, a bar for its share of the leader, and the value at the end. */
export function RankedList({
  rows,
  language,
  empty,
}: {
  rows: RankedRow[];
  language: string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  if (rows.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((row, index) => (
        <li key={row.key} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-x-3">
          <span className="text-xs text-muted tabular-nums">{index + 1}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{row.label}</p>
            {row.detail ? <p className="truncate text-xs text-muted">{row.detail}</p> : null}
            <div className="mt-1 h-1.5 rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-bold tabular-nums">
            {row.value.toLocaleString(language)}
          </span>
        </li>
      ))}
    </ol>
  );
}
