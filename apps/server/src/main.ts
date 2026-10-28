import { createApp } from './app.ts';
import { loadEnv } from './config/env.ts';

const env = loadEnv();
const app = createApp().listen(env.PORT);

console.info(`lyra listening on http://localhost:${app.server?.port ?? env.PORT}`);
