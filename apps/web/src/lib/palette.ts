const SAMPLE_SIZE = 24;
const MIN_SATURATION = 0.25;
const MIN_LIGHTNESS = 0.2;
const MAX_LIGHTNESS = 0.8;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

function toHsl({ r, g, b }: Rgb) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return { saturation, lightness };
}

/** Averages the vivid pixels, so the accent comes from the art's colors, not its shadows. */
export function dominantColor(pixels: Uint8ClampedArray): Rgb | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const pixel = { r: pixels[index] ?? 0, g: pixels[index + 1] ?? 0, b: pixels[index + 2] ?? 0 };
    const { saturation, lightness } = toHsl(pixel);

    if (saturation >= MIN_SATURATION && lightness >= MIN_LIGHTNESS && lightness <= MAX_LIGHTNESS) {
      r += pixel.r * saturation;
      g += pixel.g * saturation;
      b += pixel.b * saturation;
      weight += saturation;
    }
  }

  if (weight === 0) {
    return null;
  }

  return { r: Math.round(r / weight), g: Math.round(g / weight), b: Math.round(b / weight) };
}

export async function imageAccent(src: string): Promise<Rgb | null> {
  const image = new Image();
  image.src = src;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  return dominantColor(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
}

export function toCss({ r, g, b }: Rgb) {
  return `rgb(${r} ${g} ${b})`;
}

/** A lighter, warmer partner color for gradients. */
export function shiftColor({ r, g, b }: Rgb, amount = 40): Rgb {
  return {
    r: Math.min(255, r + amount),
    g: Math.min(255, g + amount / 2),
    b: Math.max(0, b - amount / 2),
  };
}
