import { useId } from 'react';

// The equalizer bars that also draw an "L", on the brand gradient. Same shapes as
// assets/logo-light.svg and the icons made by scripts/generate-icons.ts.
const BARS = [
  { x: 24, y: 24, height: 80, opacity: 1 },
  { x: 46, y: 76, height: 28, opacity: 0.9 },
  { x: 68, y: 62, height: 42, opacity: 0.8 },
  { x: 90, y: 84, height: 20, opacity: 0.7 },
] as const;
const BAR_WIDTH = 15;

export function LogoMark({ className = '' }: { className?: string }) {
  const gradient = useId();

  return (
    <svg viewBox="0 0 128 128" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f39c4a" />
          <stop offset="0.55" stopColor="#e0457b" />
          <stop offset="1" stopColor="#8b2a6b" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill={`url(#${gradient})`} />
      {BARS.map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width={BAR_WIDTH}
          height={bar.height}
          rx={BAR_WIDTH / 2}
          fill="#fff"
          fillOpacity={bar.opacity}
        />
      ))}
    </svg>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight">
      <LogoMark className="size-[30px]" />
      lyra
    </div>
  );
}
