import { Elysia } from 'elysia';

import { moduleLogger } from './logger.ts';

const log = moduleLogger('http');
// Errors Elysia raises for bad input or missing routes are answered normally; only real
// failures inside handlers are worth an error line.
const UNEXPECTED = new Set(['UNKNOWN', 'INTERNAL_SERVER_ERROR']);

/**
 * At debug level, one line per request: method, path, status and duration. The query string is
 * left out, since searches and stream options do not belong in logs.
 */
export function httpLog() {
  const startedAt = new WeakMap<Request, number>();

  return new Elysia({ name: 'http-log' })
    .onRequest(({ request }) => {
      if (log.isLevelEnabled('debug')) {
        startedAt.set(request, performance.now());
      }
    })
    .onAfterResponse({ as: 'global' }, ({ request, set }) => {
      const start = startedAt.get(request);

      if (start === undefined) {
        return;
      }

      const ms = Math.round(performance.now() - start);
      log.debug(`${request.method} ${new URL(request.url).pathname} ${String(set.status)} ${ms}ms`);
    })
    .onError({ as: 'global' }, ({ code, error, request }) => {
      if (UNEXPECTED.has(String(code))) {
        log.error({ err: error }, `${request.method} ${new URL(request.url).pathname} failed`);
      }
    });
}
