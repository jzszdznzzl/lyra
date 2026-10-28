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

export interface VideoFormatInfo {
  itag: number;
  height: number;
  codec: string;
  isDrc: boolean;
}

// H.264 decodes in hardware on every phone; VP9 and AV1 only on some, and drain batteries.
const CODEC_PREFERENCE = ['avc1', 'vp9', 'av01'];

/** Tallest video at or under `maxHeight`, preferring H.264, then VP9, then AV1. */
export function pickVideoFormat<T extends VideoFormatInfo>(
  formats: readonly T[],
  maxHeight: number,
) {
  const rank = (codec: string) => {
    const index = CODEC_PREFERENCE.findIndex((prefix) => codec.startsWith(prefix));

    return index === -1 ? CODEC_PREFERENCE.length : index;
  };
  const fitting = formats.filter((format) => format.height <= maxHeight);
  const pool =
    fitting.length > 0 ? fitting : [...formats].sort((a, b) => a.height - b.height).slice(0, 1);

  return [...pool].sort((a, b) => b.height - a.height || rank(a.codec) - rank(b.codec))[0] ?? null;
}
