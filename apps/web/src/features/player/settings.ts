import { z } from 'zod';

import {
  AudioQuality,
  DEFAULT_VIDEO_HEIGHT,
  MAX_CROSSFADE_SECONDS,
  MAX_FADE_MS,
  MAX_VOLUME,
  VIDEO_HEIGHTS,
} from '@lyra/shared';
import type { ListeningPreferences } from '@lyra/shared';

import { EQ_FREQUENCIES, EqPreset } from '../../audio/equalizer.ts';

const STORAGE_KEY = 'lyra.player-settings';

const DATA_SAVER_VIDEO_HEIGHT = 360;
// One tap of the volume − or + buttons: 5%.
export const VOLUME_BUTTON_STEP = 0.05;

const VideoHeightSetting = z
  .number()
  .refine((height) => VIDEO_HEIGHTS.some((allowed) => allowed === height));

const NetworkInfo = z.object({ type: z.string().optional(), saveData: z.boolean().optional() });

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
  volume: z.number().min(0).max(MAX_VOLUME).catch(0.8),
  // Lets the volume go past 100%; off by default, as it can harm hearing and small speakers.
  isVolumeBoostEnabled: z.boolean().catch(false),
  // A limiter catches the peaks that would otherwise distort (boost, equalizer, leveling).
  isLimiterEnabled: z.boolean().catch(true),
  isNormalizationEnabled: z.boolean().catch(true),
  isAutoplayEnabled: z.boolean().catch(true),
  // DJ-style transitions: songs come in on the beat, at the same tempo. Replaces the crossfade.
  isMixEnabled: z.boolean().catch(false),
  // Off shows synced lyrics as plain text: no highlighted line, no scrolling along.
  isLyricsSyncEnabled: z.boolean().catch(true),
  videoHeight: VideoHeightSetting.catch(DEFAULT_VIDEO_HEIGHT),
  // On mobile data (or with the browser's data saver) these replace the two above.
  isDataSaverEnabled: z.boolean().catch(true),
  cellularQuality: z.enum(AudioQuality).catch(AudioQuality.Normal),
  cellularVideoHeight: VideoHeightSetting.catch(DATA_SAVER_VIDEO_HEIGHT),
});

export type PlayerSettings = z.infer<typeof PlayerSettings>;

/**
 * Settings are kept per device, so they work offline and on the first visit. The listening
 * preferences among them are also synced with the account (see preferences-sync.ts).
 */
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

/** The highest volume the slider allows: 100%, or more with the boost on. */
export function maxVolume(settings: PlayerSettings) {
  return settings.isVolumeBoostEnabled ? MAX_VOLUME : 1;
}

export function outputSettings(settings: PlayerSettings) {
  return {
    isLimiterEnabled: settings.isLimiterEnabled,
    isNormalizationEnabled: settings.isNormalizationEnabled,
  };
}

/** The settings that follow the account to every device. */
export function pickPreferences(settings: PlayerSettings): ListeningPreferences {
  return {
    crossfadeSeconds: settings.crossfadeSeconds,
    fadeMs: settings.fadeMs,
    isMixEnabled: settings.isMixEnabled,
    isEqEnabled: settings.isEqEnabled,
    eqPreset: settings.eqPreset,
    eqGains: settings.eqGains,
    isNormalizationEnabled: settings.isNormalizationEnabled,
    isLimiterEnabled: settings.isLimiterEnabled,
    isAutoplayEnabled: settings.isAutoplayEnabled,
    isLyricsSyncEnabled: settings.isLyricsSyncEnabled,
  };
}

/** True on mobile data or when the browser's data saver is on (Network Information API). */
export function isOnMeteredNetwork() {
  const info = NetworkInfo.safeParse(Reflect.get(navigator, 'connection'));

  return info.success && (info.data.type === 'cellular' || info.data.saveData === true);
}

export function effectiveQuality(settings: PlayerSettings) {
  const isSaving = settings.isDataSaverEnabled && isOnMeteredNetwork();

  return {
    quality: isSaving ? settings.cellularQuality : settings.quality,
    videoHeight: isSaving ? settings.cellularVideoHeight : settings.videoHeight,
  };
}
