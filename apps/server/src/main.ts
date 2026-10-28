import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { Elysia } from 'elysia';

import { createApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import { openDatabase } from './db/index.ts';
import { createMailer } from './mail/index.ts';
import { ImageRegistry } from './images/registry.ts';
import { LinkPreviews } from './previews/previews.ts';
import { originGuard } from './security.ts';
import { InnertubePool } from './ytmusic/innertube.ts';
import { webStatic } from './web-static.ts';
import type { AppContext } from './context.ts';

const env = loadEnv();

await mkdir(env.DATA_DIR, { recursive: true });

const ctx: AppContext = {
  // src/main.ts and dist/main.mjs both sit one level below the package root, next to drizzle/.
  db: openDatabase(join(env.DATA_DIR, 'lyra.db'), new URL('../drizzle', import.meta.url).pathname),
  env,
  mailer: createMailer(env),
  secretKey: Buffer.from(env.SECRET_KEY, 'base64'),
  dataDir: env.DATA_DIR,
  now: Date.now,
};
const api = createApp(ctx);
const app = (
  env.WEB_DIST
    ? new Elysia()
        .use(originGuard(ctx))
        .use(api)
        .use(
          webStatic(
            env.WEB_DIST,
            env.PUBLIC_URL,
            new LinkPreviews(new InnertubePool(env.DATA_DIR), new ImageRegistry(ctx), Date.now),
          ),
        )
    : api
).listen(env.PORT);

console.info(`lyra listening on http://localhost:${app.server?.port ?? env.PORT}`);
