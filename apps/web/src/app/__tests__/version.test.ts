import { afterEach, describe, expect, test } from 'vitest';

import { changelog, currentBuild, installedAt, newChanges, versionLabel } from '../version.ts';
import type { ChangelogEntry } from '../version.ts';

function entry(id: string): ChangelogEntry {
  return { id, date: '2026-10-28', changes: { es: ['Algo'], en: ['Something'] } };
}

afterEach(() => {
  localStorage.clear();
});

describe('version', () => {
  test('the hand-written changelog is valid, with unique ids, newest first', () => {
    expect(changelog.length).toBeGreaterThan(0);
    expect(new Set(changelog.map((item) => item.id)).size).toBe(changelog.length);

    const dates = changelog.map((item) => item.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  test('the build carries a date and commit version', () => {
    expect(currentBuild.version).toMatch(/^(\d{4}\.\d{2}\.\d{2}|dev)-[\w]+$/);
    expect(versionLabel('2026.10.28-62fec70')).toBe('2026.10.28 · 62fec70');
  });

  test('only entries this build lacks count as new', () => {
    expect(newChanges([entry('c'), entry('b'), entry('a')], [entry('b'), entry('a')])).toEqual([
      entry('c'),
    ]);
    expect(newChanges([entry('a')], [entry('a')])).toEqual([]);
  });

  test('the install time is kept until the version changes', () => {
    expect(installedAt(1000)).toBe(1000);
    expect(installedAt(5000)).toBe(1000);

    localStorage.setItem('lyra.installed', JSON.stringify({ commit: 'older', at: 1 }));
    expect(installedAt(9000)).toBe(9000);
  });
});
