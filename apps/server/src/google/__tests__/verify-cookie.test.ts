import { describe, expect, test } from 'bun:test';

import { hasSessionCookie, verifyGoogleCookie } from '../verify-cookie.ts';

describe('google cookies', () => {
  test('detects the session cookie', () => {
    expect(hasSessionCookie('PREF=x; SAPISID=abc/def; SID=1')).toBe(true);
    expect(hasSessionCookie('PREF=x; VISITOR_INFO1_LIVE=y')).toBe(false);
  });

  test('rejects cookies without a session before calling Google', async () => {
    expect(await verifyGoogleCookie('PREF=hl=en')).toEqual({
      data: null,
      error: 'invalid_cookies',
    });
  });
});
