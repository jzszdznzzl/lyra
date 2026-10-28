import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { Elysia } from 'elysia';

import { createApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import { openDatabase } from './db/index.ts';
import { createMailer } from './mail/index.ts';
import { webStatic } from './web-static.ts';

const env = loadEnv();

await mkdir(env.DATA_DIR, { recursive: true });

const api = createApp({
  // src/main.ts and dist/main.mjs both sit one level below the package root, next to drizzle/.
  db: openDatabase(join(env.DATA_DIR, 'lyra.db'), new URL('../drizzle', import.meta.url).pathname),
  env,
  mailer: createMailer(env),
  secretKey: Buffer.from(env.SECRET_KEY, 'base64'),
  dataDir: env.DATA_DIR,
  now: Date.now,
});
const app = (env.WEB_DIST ? new Elysia().use(api).use(webStatic(env.WEB_DIST)) : api).listen(
  env.PORT,
);

console.info(`lyra listening on http://localhost:${app.server?.port ?? env.PORT}`);
