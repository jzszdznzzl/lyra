import { EQ_MAX_DB, EQ_MIN_DB, EqPreset } from '@lyra/shared';

// The bands and limits are shared, because the account's saved equalizer must fit them.
export { EQ_FREQUENCIES, EQ_MAX_DB, EQ_MIN_DB, EqPreset } from '@lyra/shared';

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
