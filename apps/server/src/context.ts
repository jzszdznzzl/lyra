import type { Env } from './config/env.ts';
import type { Database } from './db/index.ts';
import type { Mailer } from './mail/index.ts';
import type { SettingsStore } from './settings/settings.ts';

/** Everything a request handler needs, built once in `main.ts` and swapped in tests. */
export interface AppContext {
  db: Database;
  env: Env;
  mailer: Mailer;
  settings: SettingsStore;
  secretKey: Buffer;
  dataDir: string;
  now: () => number;
}
