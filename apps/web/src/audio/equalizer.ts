export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;

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

export const EQ_PRESETS: Record<Exclude<EqPreset, 'custom'>, number[]> = {
  [EqPreset.Flat]: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [EqPreset.BassBoost]: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  [EqPreset.TrebleBoost]: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  [EqPreset.Vocal]: [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  [EqPreset.Rock]: [5, 4, 2, -1, -2, -1, 2, 3, 4, 4],
  [EqPreset.Pop]: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  [EqPreset.Electronic]: [5, 4, 1, 0, -2, 1, 0, 2, 4, 5],
  [EqPreset.Acoustic]: [3, 3, 2, 1, 1, 1, 2, 2, 2, 1],
};

export function clampGain(value: number) {
  return Math.min(EQ_MAX_DB, Math.max(EQ_MIN_DB, value));
}
