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

console.info(`icons written to ${OUT}`);
