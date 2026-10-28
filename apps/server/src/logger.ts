import pino from 'pino';
import pretty from 'pino-pretty';
import { z } from 'zod';

import { Env, LogFormat, LogLevel } from './config/env.ts';

const LoggingEnv = z.object({
  LOG_LEVEL: Env.shape.LOG_LEVEL,
  LOG_FORMAT: Env.shape.LOG_FORMAT,
  NODE_ENV: z.string().optional(),
});

export const logger = createRootLogger(process.env);

/**
 * Read straight from the environment, because modules log before main.ts builds the context.
 * A bad value falls back to the defaults here; loadEnv then stops the server with the error.
 */
function createRootLogger(source: Record<string, string | undefined>) {
  const parsed = LoggingEnv.safeParse(source);
  const env = parsed.success
    ? parsed.data
    : { LOG_LEVEL: LogLevel.Info, LOG_FORMAT: LogFormat.Pretty, NODE_ENV: source['NODE_ENV'] };
  // `bun test` sets NODE_ENV=test; tests stay quiet unless LOG_LEVEL asks otherwise.
  const level =
    env.NODE_ENV === 'test' && source['LOG_LEVEL'] === undefined ? LogLevel.Silent : env.LOG_LEVEL;

  if (env.LOG_FORMAT === LogFormat.Json) {
    return pino({ level });
  }

  // A plain stream, not a pino transport: transports load modules by path in worker threads,
  // which breaks once the server is bundled.
  return pino(
    { level },
    pretty({
      sync: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname,module',
      messageFormat: '[{module}] {msg}',
    }),
  );
}

/** A logger whose lines say which part of the server wrote them. */
export function moduleLogger(module: string) {
  return logger.child({ module });
}

/** First line of an error message, for logs about failures that are expected now and then. */
export function errorMessage(error: unknown) {
  return error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
}
