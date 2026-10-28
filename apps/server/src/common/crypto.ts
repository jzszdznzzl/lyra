import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const CIPHER = 'aes-256-gcm';

export function randomToken(bytes = TOKEN_BYTES) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

/** Encrypts with AES-256-GCM. Output: base64url of iv ‖ tag ‖ ciphertext. */
export function encrypt(plaintext: string, key: Buffer) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

/** Reverses `encrypt`. Returns null when the data was tampered with or the key changed. */
export function decrypt(payload: string, key: Buffer): string | null {
  const data = Buffer.from(payload, 'base64url');

  if (data.length < IV_BYTES + AUTH_TAG_BYTES) {
    return null;
  }

  try {
    const decipher = createDecipheriv(CIPHER, key, data.subarray(0, IV_BYTES));
    decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES));

    return Buffer.concat([
      decipher.update(data.subarray(IV_BYTES + AUTH_TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
