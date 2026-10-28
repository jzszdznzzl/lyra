import { z } from 'zod';

import { Language } from '@lyra/shared';

import changelogJson from '../changelog.json';

// Replaced at build time by vite.config.ts; parsed like any other outside data.
declare const __LYRA_BUILD__: unknown;

const ChangeList = z.array(z.string().min(1)).min(1);
const Installed = z.object({ commit: z.string(), at: z.number() });

export const BuildInfo = z.object({
  version: z.string(),
  commit: z.string(),
  builtAt: z.iso.datetime(),
});

export type BuildInfo = z.infer<typeof BuildInfo>;

export const ChangelogEntry = z.object({
  id: z.string(),
  date: z.iso.date(),
  changes: z.object({ [Language.Spanish]: ChangeList, [Language.English]: ChangeList }),
});

export type ChangelogEntry = z.infer<typeof ChangelogEntry>;

export const Changelog = z.array(ChangelogEntry);

const INSTALLED_KEY = 'lyra.installed';

export const currentBuild = BuildInfo.parse(__LYRA_BUILD__);
export const changelog = Changelog.parse(changelogJson);

/** "2026.10.28-62fec70" reads better as "2026.10.28 · 62fec70". */
export function versionLabel(version: string) {
  return version.replace('-', ' · ');
}

/** Changes in `latest` that this build does not have yet, newest first. */
export function newChanges(latest: ChangelogEntry[], current: ChangelogEntry[] = changelog) {
  const known = new Set(current.map((entry) => entry.id));

  return latest.filter((entry) => !known.has(entry.id));
}

/** When this device first ran the current version; recorded the first time it is asked. */
export function installedAt(now = Date.now()) {
  try {
    const stored = Installed.safeParse(JSON.parse(localStorage.getItem(INSTALLED_KEY) ?? 'null'));

    if (stored.success && stored.data.commit === currentBuild.commit) {
      return stored.data.at;
    }

    localStorage.setItem(INSTALLED_KEY, JSON.stringify({ commit: currentBuild.commit, at: now }));
  } catch {
    // Storage can be blocked; then "now" is the best answer there is.
  }

  return now;
}

/** What the server has published now, or null when offline or unreadable. */
export async function fetchLatest() {
  try {
    const [build, entries] = await Promise.all(
      ['/version.json', '/changelog.json'].map(async (path): Promise<unknown> => {
        const response = await fetch(path, { cache: 'no-store' });

        return response.ok ? response.json() : null;
      }),
    );
    const parsedBuild = BuildInfo.safeParse(build);
    const parsedChangelog = Changelog.safeParse(entries);

    return parsedBuild.success && parsedChangelog.success
      ? { build: parsedBuild.data, changelog: parsedChangelog.data }
      : null;
  } catch {
    return null;
  }
}
