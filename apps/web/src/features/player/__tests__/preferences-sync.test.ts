import { describe, expect, test } from 'vitest';

import { ListeningPreferences } from '@lyra/shared';

import { SyncAction, resolvePull, shouldApplyIncoming } from '../preferences-sync.ts';
import { PlayerSettings, pickPreferences } from '../settings.ts';

const preferences = pickPreferences(PlayerSettings.parse({}));

describe('resolvePull', () => {
  test('uploads when the account has nothing saved yet', () => {
    expect(
      resolvePull({ syncedAt: null, isDirty: false }, { preferences: null, updatedAt: null }),
    ).toBe(SyncAction.Upload);
  });

  test('a change made here while offline wins over the account copy', () => {
    expect(resolvePull({ syncedAt: 100, isDirty: true }, { preferences, updatedAt: 200 })).toBe(
      SyncAction.Upload,
    );
  });

  test('a newer account copy, or a first sync, applies here', () => {
    expect(resolvePull({ syncedAt: 100, isDirty: false }, { preferences, updatedAt: 200 })).toBe(
      SyncAction.Apply,
    );
    expect(resolvePull({ syncedAt: null, isDirty: false }, { preferences, updatedAt: 200 })).toBe(
      SyncAction.Apply,
    );
  });

  test('keeps what it has when already up to date', () => {
    expect(resolvePull({ syncedAt: 200, isDirty: false }, { preferences, updatedAt: 200 })).toBe(
      SyncAction.Keep,
    );
  });
});

describe('shouldApplyIncoming', () => {
  test('applies newer saves from other devices', () => {
    expect(shouldApplyIncoming({ syncedAt: 100, isDirty: false }, 200)).toBe(true);
  });

  test('ignores the echo of its own save and anything older', () => {
    expect(shouldApplyIncoming({ syncedAt: 200, isDirty: false }, 200)).toBe(false);
    expect(shouldApplyIncoming({ syncedAt: 200, isDirty: false }, 150)).toBe(false);
  });

  test('ignores saves while its own change is on the way', () => {
    expect(shouldApplyIncoming({ syncedAt: 100, isDirty: true }, 200)).toBe(false);
  });
});

describe('pickPreferences', () => {
  test('the default settings make valid account preferences, without per-device ones', () => {
    expect(ListeningPreferences.safeParse(preferences).success).toBe(true);
    expect(Object.keys(preferences)).not.toContain('volume');
    expect(Object.keys(preferences)).not.toContain('isVolumeBoostEnabled');
    expect(Object.keys(preferences)).not.toContain('quality');
  });
});
