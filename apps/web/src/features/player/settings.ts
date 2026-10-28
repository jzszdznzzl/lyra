import { z } from 'zod';

import { AudioQuality, DEFAULT_VIDEO_HEIGHT, VIDEO_HEIGHTS } from '@lyra/shared';

import { EQ_FREQUENCIES, EqPreset } from '../../audio/equalizer.ts';

const STORAGE_KEY = 'lyra.player-settings';

export const MAX_CROSSFADE_SECONDS = 12;
export const MAX_FADE_MS = 2000;

export const PlayerSettings = z.object({
  quality: z.enum(AudioQuality).catch(AudioQuality.High),
  crossfadeSeconds: z.number().min(0).max(MAX_CROSSFADE_SECONDS).catch(0),
  fadeMs: z.number().min(0).max(MAX_FADE_MS).catch(300),
  isEqEnabled: z.boolean().catch(false),
  eqPreset: z.enum(EqPreset).catch(EqPreset.Flat),
  eqGains: z
    .array(z.number())
    .length(EQ_FREQUENCIES.length)
    .catch(EQ_FREQUENCIES.map(() => 0)),
  volume: z.number().min(0).max(1).catch(0.8),
  isAutoplayEnabled: z.boolean().catch(true),
  videoHeight: z
    .number()
    .refine((height) => VIDEO_HEIGHTS.some((allowed) => allowed === height))
    .catch(DEFAULT_VIDEO_HEIGHT),
});

export type PlayerSettings = z.infer<typeof PlayerSettings>;

/** Settings are per device: a phone on mobile data may want a lower quality than the PC. */
export function loadSettings(): PlayerSettings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');

    return PlayerSettings.parse(stored);
  } catch {
    return PlayerSettings.parse({});
  }
}

export function saveSettings(settings: PlayerSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked; settings still apply until the tab closes.
  }
}
