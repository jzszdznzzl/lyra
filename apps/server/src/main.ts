import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import { openDatabase } from './db/index.ts';
import { createMailer } from './mail/index.ts';

const env = loadEnv();

await mkdir(env.DATA_DIR, { recursive: true });

const app = createApp({
  db: openDatabase(join(env.DATA_DIR, 'lyra.db')),
  env,
  mailer: createMailer(env),
  secretKey: Buffer.from(env.SECRET_KEY, 'base64'),
  dataDir: env.DATA_DIR,
  now: Date.now,
}).listen(env.PORT);

console.info(`lyra listening on http://localhost:${app.server?.port ?? env.PORT}`);
