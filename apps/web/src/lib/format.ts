const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** "3 minutes ago", "hace 2 días"… Anything under a minute reads as "now". */
export function formatRelative(timestamp: number, language: string, now = Date.now()) {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const elapsed = timestamp - now;

  for (const [unit, size] of UNITS) {
    if (Math.abs(elapsed) >= size) {
      return format.format(Math.round(elapsed / size), unit);
    }
  }

  return format.format(0, 'second');
}
