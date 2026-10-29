import { z } from 'zod';

export const EqPreset = Object.freeze({
  Flat: 'flat',
  BassBoost: 'bass_boost',
  TrebleBoost: 'treble_boost',
  Vocal: 'vocal',
  Rock: 'rock',
  Pop: 'pop',
  Electronic: 'electronic',
  Acoustic: 'acoustic',
  Custom: 'custom',
} as const);

export type EqPreset = (typeof EqPreset)[keyof typeof EqPreset];

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;
export const MAX_CROSSFADE_SECONDS = 12;
export const MAX_FADE_MS = 2000;

/**
 * The player settings that follow the account to every device. Volume, its boost, quality and
 * the data saver stay per device: they depend on the speaker and the network, not on taste.
 */
export const ListeningPreferences = z.object({
  crossfadeSeconds: z.number().min(0).max(MAX_CROSSFADE_SECONDS),
  fadeMs: z.number().min(0).max(MAX_FADE_MS),
  isMixEnabled: z.boolean(),
  isEqEnabled: z.boolean(),
  eqPreset: z.enum(EqPreset),
  eqGains: z.array(z.number().min(EQ_MIN_DB).max(EQ_MAX_DB)).length(EQ_FREQUENCIES.length),
  isNormalizationEnabled: z.boolean(),
  isLimiterEnabled: z.boolean(),
  isAutoplayEnabled: z.boolean(),
  isLyricsSyncEnabled: z.boolean(),
});

export type ListeningPreferences = z.infer<typeof ListeningPreferences>;

/** What the account has saved; both are null until a device uploads its settings. */
export const SyncedPreferences = z.object({
  preferences: ListeningPreferences.nullable(),
  // Server time of the last save, so devices can tell which copy is newer.
  updatedAt: z.number().nullable(),
});

export type SyncedPreferences = z.infer<typeof SyncedPreferences>;
