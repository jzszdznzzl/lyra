import { describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';

import { decrypt, encrypt, randomToken, sha256 } from '../crypto.ts';

describe('crypto', () => {
  const key = randomBytes(32);

  test('encrypt round-trips', () => {
    expect(decrypt(encrypt('SID=abc; HSID=def', key), key)).toBe('SID=abc; HSID=def');
  });

  test('decrypt rejects another key', () => {
    expect(decrypt(encrypt('secret', key), randomBytes(32))).toBeNull();
  });

  test('decrypt rejects garbage', () => {
    expect(decrypt('short', key)).toBeNull();
  });

  test('tokens are unique and hashes are stable', () => {
    expect(randomToken()).not.toBe(randomToken());
    expect(sha256('a')).toBe(sha256('a'));
  });
});
