import { Elysia } from 'elysia';

export function createApp() {
  return new Elysia({ prefix: '/api' }).get('/health', () => ({ status: 'ok' }));
}

export type App = ReturnType<typeof createApp>;
