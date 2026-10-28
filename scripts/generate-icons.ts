import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

// Run with: bun scripts/generate-icons.ts (from apps/server, where sharp is installed).
const OUT = join(import.meta.dirname, '..', 'apps', 'web', 'public', 'icons');

/** The brand mark: a rounded tile with the cover-art gradient and a record hole. */
function mark(size: number, isMaskable: boolean) {
  // Maskable icons are cropped to a circle or squircle; keep the mark inside the 80% safe zone.
  const tile = isMaskable ? size : size * 0.86;
  const offset = (size - tile) / 2;
  const radius = isMaskable ? 0 : tile * 0.28;
  const hole = tile * (isMaskable ? 0.14 : 0.17);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f39c4a"/>
      <stop offset="0.55" stop-color="#e0457b"/>
      <stop offset="1" stop-color="#8b2a6b"/>
    </linearGradient>
  </defs>
  <rect x="${offset}" y="${offset}" width="${tile}" height="${tile}" rx="${radius}" fill="url(#g)"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${hole}" fill="#0b0a0f"/>
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
