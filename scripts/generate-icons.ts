import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

// Run from apps/server, where sharp is installed:
//   NODE_PATH=$PWD/node_modules bun ../../scripts/generate-icons.ts
const OUT = join(import.meta.dirname, '..', 'apps', 'web', 'public', 'icons');

// The equalizer bars that also draw an "L", in a 128-unit square (same as apps/web/src/ui/brand.tsx).
const BARS = [
  { x: 24, y: 24, height: 80, opacity: 1 },
  { x: 46, y: 76, height: 28, opacity: 0.9 },
  { x: 68, y: 62, height: 42, opacity: 0.8 },
  { x: 90, y: 84, height: 20, opacity: 0.7 },
] as const;
const BAR_WIDTH = 15;
const MARK_UNITS = 128;
// Maskable icons are cropped to a circle or squircle; the bars shrink into the 80% safe zone.
const MASKABLE_SCALE = 0.78;

/** The brand mark: a rounded tile with the cover-art gradient and the equalizer "L". */
function mark(size: number, isMaskable: boolean) {
  const tile = isMaskable ? size : size * 0.86;
  const offset = (size - tile) / 2;
  const radius = isMaskable ? 0 : tile * 0.25;
  const scale = (tile / MARK_UNITS) * (isMaskable ? MASKABLE_SCALE : 1);
  const inset = offset + (tile - MARK_UNITS * scale) / 2;
  const bars = BARS.map(
    (bar) =>
      `<rect x="${bar.x}" y="${bar.y}" width="${BAR_WIDTH}" height="${bar.height}" rx="${BAR_WIDTH / 2}" fill="#fff" fill-opacity="${bar.opacity}"/>`,
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f39c4a"/>
      <stop offset="0.55" stop-color="#e0457b"/>
      <stop offset="1" stop-color="#8b2a6b"/>
    </linearGradient>
  </defs>
  <rect x="${offset}" y="${offset}" width="${tile}" height="${tile}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">${bars}</g>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'favicon.svg'), mark(64, false));

for (const [name, size, isMaskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
] as const) {
  await sharp(Buffer.from(mark(size, isMaskable)))
    .png()
    .toFile(join(OUT, name));
}

// Link preview banner (Open Graph): 1200×630, the mark beside the name and the tagline.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">
  <defs>
    <radialGradient id="glow" cx="0.3" cy="0.2" r="0.9">
      <stop offset="0" stop-color="#e0457b" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#0b0a0f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#0b0a0f"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <g transform="translate(110 195)">${mark(240, false).replace(/<\/?svg[^>]*>/g, '')}</g>
  <text x="400" y="315" font-family="Manrope, DejaVu Sans, sans-serif" font-size="128" font-weight="800" fill="#f4f1f6">lyra</text>
  <text x="404" y="395" font-family="Manrope, DejaVu Sans, sans-serif" font-size="40" fill="#a39cab">Your music, everywhere you are.</text>
</svg>`;
await sharp(Buffer.from(banner))
  .png()
  .toFile(join(OUT, '..', 'og.png'));

console.info(`icons written to ${OUT}`);
