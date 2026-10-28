import { describe, expect, test } from 'bun:test';

import { loadEnv } from '../env.ts';

const BASE = {
  PORT: '39422',
  PUBLIC_URL: 'http://localhost:44790',
  SECRET_KEY: Buffer.alloc(32, 7).toString('base64'),
  MAIL_FROM: 'Lyra <noreply@lyra.test>',
};

describe('logging settings', () => {
  test('default to readable lines at info level', () => {
    const env = loadEnv(BASE);

    expect(env.LOG_LEVEL).toBe('info');
    expect(env.LOG_FORMAT).toBe('pretty');
  });

  test('accept pino levels and refuse anything else', () => {
    expect(loadEnv({ ...BASE, LOG_LEVEL: 'debug', LOG_FORMAT: 'json' }).LOG_LEVEL).toBe('debug');
    expect(() => loadEnv({ ...BASE, LOG_LEVEL: 'loud' })).toThrow('Invalid environment');
    expect(() => loadEnv({ ...BASE, LOG_FORMAT: 'xml' })).toThrow('Invalid environment');
  });
});
