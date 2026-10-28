import { describe, expect, test } from 'vitest';

import { dominantColor } from '../palette.ts';

function pixels(...colors: [number, number, number][]) {
  return new Uint8ClampedArray(colors.flatMap(([r, g, b]) => [r, g, b, 255]));
}

describe('dominantColor', () => {
  test('ignores greys and near-black pixels', () => {
    expect(dominantColor(pixels([224, 69, 123], [20, 20, 20], [128, 128, 128]))).toEqual({
      r: 224,
      g: 69,
      b: 123,
    });
  });

  test('returns null for a greyscale image', () => {
    expect(dominantColor(pixels([10, 10, 10], [200, 200, 200]))).toBeNull();
  });
});
