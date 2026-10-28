import { describe, expect, test } from 'bun:test';

import { loadEnv } from '../env.ts';

const VALID = {
  PORT: '39422',
  PUBLIC_URL: 'https://lyra.example.com',
  SECRET_KEY: Buffer.alloc(32, 1).toString('base64'),
  MAIL_FROM: 'Lyra <noreply@example.com>',
};

describe('loadEnv', () => {
  test('parses a valid environment', () => {
    const env = loadEnv(VALID);

    expect(env.PORT).toBe(39_422);
    expect(env.MAIL_TRANSPORT).toBe('smtp');
  });

  test('rejects a short secret key', () => {
    expect(() => loadEnv({ ...VALID, SECRET_KEY: Buffer.alloc(8).toString('base64') })).toThrow(
      'SECRET_KEY',
    );
  });
});
