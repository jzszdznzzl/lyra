import { afterEach, describe, expect, test } from 'vitest';

import { PlayerSettings, effectiveQuality } from '../settings.ts';

function setConnection(value: unknown) {
  Object.defineProperty(navigator, 'connection', { value, configurable: true });
}

afterEach(() => setConnection(undefined));

describe('player settings', () => {
  test('fills defaults and repairs invalid values', () => {
    const settings = PlayerSettings.parse({ videoHeight: 999, crossfadeSeconds: 99 });

    expect(settings.videoHeight).toBe(720);
    expect(settings.crossfadeSeconds).toBe(0);
    expect(settings.cellularVideoHeight).toBe(360);
  });

  test('uses the mobile-data qualities on cellular when data saver is on', () => {
    const settings = PlayerSettings.parse({ quality: 'max', videoHeight: 1080 });

    setConnection({ type: 'wifi' });
    expect(effectiveQuality(settings)).toEqual({ quality: 'max', videoHeight: 1080 });

    setConnection({ type: 'cellular' });
    expect(effectiveQuality(settings)).toEqual({ quality: 'normal', videoHeight: 360 });

    expect(effectiveQuality({ ...settings, isDataSaverEnabled: false })).toEqual({
      quality: 'max',
      videoHeight: 1080,
    });
  });
});
