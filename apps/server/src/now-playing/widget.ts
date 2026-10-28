import { Language } from '@lyra/shared';
import type { NowPlaying } from '@lyra/shared';

interface WidgetInput {
  nowPlaying: NowPlaying | null;
  // A data: URI. Images inside an SVG shown through <img> cannot load anything external.
  cover: string | null;
  language: Language;
  theme: WidgetTheme;
  now: number;
}

export const WidgetTheme = Object.freeze({ Dark: 'dark', Light: 'light' } as const);

export type WidgetTheme = (typeof WidgetTheme)[keyof typeof WidgetTheme];

const WIDTH = 400;
const HEIGHT = 104;
const COVER_SIZE = 72;
const PADDING = 16;
const TEXT_X = PADDING * 2 + COVER_SIZE;
// Characters, not pixels: SVG has no text measuring, and this fits the card in common fonts.
const TITLE_MAX_CHARS = 30;
const ARTISTS_MAX_CHARS = 36;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const ACCENT = '#e0457b';
const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const COLORS = {
  [WidgetTheme.Dark]: {
    bg: '#0b0a0f',
    line: '#24212b',
    cover: '#1c1a22',
    text: '#f4f1f6',
    muted: '#a39cab',
  },
  [WidgetTheme.Light]: {
    bg: '#f7f3f5',
    line: '#e4dde2',
    cover: '#e9e3e7',
    text: '#1b1720',
    muted: '#6d6575',
  },
} as const satisfies Record<WidgetTheme, Record<string, string>>;

const TEXTS = {
  [Language.English]: {
    playing: 'Listening now',
    last: 'Last played',
    idle: 'Not listening to anything',
  },
  [Language.Spanish]: {
    playing: 'Escuchando ahora',
    last: 'Última canción',
    idle: 'No está escuchando nada',
  },
} as const satisfies Record<Language, Record<string, string>>;

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function truncate(value: string, maxChars: number) {
  const chars = Array.from(value);

  return chars.length > maxChars
    ? `${chars
        .slice(0, maxChars - 1)
        .join('')
        .trimEnd()}…`
    : value;
}

function timeAgo(ms: number, language: Language) {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

  if (ms < HOUR_MS) {
    return format.format(-Math.floor(ms / MINUTE_MS), 'minute');
  }

  if (ms < DAY_MS) {
    return format.format(-Math.floor(ms / HOUR_MS), 'hour');
  }

  return format.format(-Math.floor(ms / DAY_MS), 'day');
}

function equalizer(x: number, y: number) {
  return [0, 1, 2]
    .map(
      (bar) =>
        `<rect class="bar" style="animation-delay:${bar * 0.25}s" x="${x + bar * 5}" y="${y - 10}" width="3" height="10" rx="1" fill="${ACCENT}"/>`,
    )
    .join('');
}

/** The public "now playing" card: an SVG that works as an image in READMEs and web pages. */
export function renderWidget({ nowPlaying, cover, language, theme, now }: WidgetInput) {
  const colors = COLORS[theme];
  const texts = TEXTS[language];
  const coverY = (HEIGHT - COVER_SIZE) / 2;
  let label: string = texts.idle;
  let body = '';

  if (nowPlaying) {
    const isPlaying = nowPlaying.isPlaying;
    const artists = nowPlaying.track.artists.map((artist) => artist.name).join(', ');
    label = isPlaying
      ? texts.playing
      : `${texts.last} · ${timeAgo(Math.max(0, now - nowPlaying.updatedAt), language)}`;
    body = [
      `<text x="${TEXT_X}" y="62" font-size="16" font-weight="700" fill="${colors.text}">${escapeXml(truncate(nowPlaying.track.title, TITLE_MAX_CHARS))}</text>`,
      `<text x="${TEXT_X}" y="82" font-size="13" fill="${colors.muted}">${escapeXml(truncate(artists, ARTISTS_MAX_CHARS))}</text>`,
    ].join('');
  }

  const labelX = nowPlaying?.isPlaying ? TEXT_X + 20 : TEXT_X;
  const coverImage = cover
    ? `<image href="${escapeXml(cover)}" x="${PADDING}" y="${coverY}" width="${COVER_SIZE}" height="${COVER_SIZE}" clip-path="url(#cover)" preserveAspectRatio="xMidYMid slice"/>`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(label)}">`,
    `<style>.bar{transform-box:fill-box;transform-origin:bottom;animation:eq .9s ease-in-out infinite alternate}@keyframes eq{from{transform:scaleY(.3)}to{transform:scaleY(1)}}</style>`,
    `<defs><clipPath id="cover"><rect x="${PADDING}" y="${coverY}" width="${COVER_SIZE}" height="${COVER_SIZE}" rx="10"/></clipPath></defs>`,
    `<rect x=".5" y=".5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="16" fill="${colors.bg}" stroke="${colors.line}"/>`,
    `<rect x="${PADDING}" y="${coverY}" width="${COVER_SIZE}" height="${COVER_SIZE}" rx="10" fill="${colors.cover}"/>`,
    coverImage,
    `<g font-family="${escapeXml(FONT)}">`,
    nowPlaying?.isPlaying ? equalizer(TEXT_X, 37) : '',
    `<text x="${labelX}" y="${nowPlaying ? 36 : 58}" font-size="11" font-weight="700" letter-spacing=".06em" fill="${nowPlaying?.isPlaying ? ACCENT : colors.muted}">${escapeXml(label.toUpperCase())}</text>`,
    body,
    `<text x="${WIDTH - PADDING}" y="${HEIGHT - 12}" text-anchor="end" font-size="10" font-weight="700" fill="${colors.muted}">Lyra</text>`,
    '</g></svg>',
  ].join('');
}
