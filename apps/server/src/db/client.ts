import { Database as SqliteDatabase } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

import * as schema from './schema.ts';

export type Database = BunSQLiteDatabase<typeof schema>;

export const IN_MEMORY = ':memory:';

// `src/` and `dist/` both sit one level below the package root, next to `drizzle/`.
export const MIGRATIONS_FOLDER = new URL('../../drizzle', import.meta.url).pathname;

export function openDatabase(path: string, migrationsFolder = MIGRATIONS_FOLDER): Database {
  const sqlite = new SqliteDatabase(path, { create: true, strict: true });

  // WAL lets the HTTP handlers read while a download or sync writes.
  sqlite.run('PRAGMA journal_mode = WAL');
  sqlite.run('PRAGMA foreign_keys = ON');

  const db = drizzle({ client: sqlite, schema });

  migrate(db, { migrationsFolder });

  return db;
}
