import { describe, expect, test } from 'bun:test';

import { isAllowedEmail } from '../email-policy.ts';
import { isStrongPassword } from '../password-policy.ts';

describe('email policy', () => {
  test('accepts regular providers and rejects disposable ones', () => {
    expect(isAllowedEmail('someone@gmail.com')).toBe(true);
    expect(isAllowedEmail('someone@mailinator.com')).toBe(false);
    expect(isAllowedEmail('someone@yopmail.com')).toBe(false);
  });
});

describe('password policy', () => {
  test('rejects common and personal passwords', () => {
    expect(isStrongPassword('password123', [])).toBe(false);
    expect(isStrongPassword('contraseña2024', [])).toBe(false);
    expect(isStrongPassword('josedaniel2024', ['josedaniel'])).toBe(false);
  });

  test('accepts a long random passphrase', () => {
    expect(isStrongPassword('violet-harbor-71-quietly-ember', [])).toBe(true);
  });
});
