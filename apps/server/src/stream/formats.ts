import { AudioQuality } from '@lyra/shared';

export interface AudioFormatInfo {
  itag: number;
  bitrate: number;
  mimeType: string;
  isDrc: boolean;
}

// Targets in bits per second; YouTube's audio tiers sit near 50k, 70k, 130-160k and 256k.
const TARGET_BITRATE: Record<AudioQuality, number> = {
  [AudioQuality.Low]: 50_000,
  [AudioQuality.Normal]: 96_000,
  [AudioQuality.High]: 160_000,
  [AudioQuality.Max]: Number.POSITIVE_INFINITY,
};

/**
 * Picks the audio format closest to the quality's target without going over it, falling back
 * to the smallest one. Dynamic-range-compressed variants lose dynamics, so they come last.
 */
export function pickAudioFormat<T extends AudioFormatInfo>(
  formats: readonly T[],
  quality: AudioQuality,
) {
  const candidates = formats.filter((format) => !format.isDrc);
  const pool = candidates.length > 0 ? candidates : [...formats];
  const sorted = [...pool].sort((a, b) => b.bitrate - a.bitrate);
  const target = TARGET_BITRATE[quality];

  return sorted.find((format) => format.bitrate <= target * 1.1) ?? sorted.at(-1) ?? null;
}
