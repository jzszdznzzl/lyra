import { Innertube, UniversalCache } from 'youtubei.js';

import { GoogleError, err, ok } from '@lyra/shared';
import type { Result } from '@lyra/shared';

import { bestThumbnail } from '../ytmusic/mappers.ts';
import type { GoogleIdentity } from './accounts.ts';

// YouTube signs authenticated requests with SAPISID; without one the cookie is not a session.
const SESSION_COOKIES = ['SAPISID', '__Secure-3PAPISID'];

export function hasSessionCookie(cookie: string) {
  return cookie
    .split(';')
    .map((pair) => pair.trim().split('=')[0])
    .some((name) => name !== undefined && SESSION_COOKIES.includes(name));
}

/** Signs in with the cookie and reads the active account, proving the cookie works. */
export async function verifyGoogleCookie(
  cookie: string,
): Promise<Result<GoogleIdentity, GoogleError>> {
  if (!hasSessionCookie(cookie)) {
    return err(GoogleError.InvalidCookies);
  }

  try {
    const yt = await Innertube.create({ cookie, cache: new UniversalCache(false) });

    if (!yt.session.logged_in) {
      return err(GoogleError.NotSignedIn);
    }

    const accounts = await yt.account.getInfo(true);
    const active = accounts.find((account) => account.is_selected) ?? accounts[0];

    if (!active) {
      return err(GoogleError.NotSignedIn);
    }

    const byline = active.account_byline.toString();

    return ok({
      name: active.account_name.toString(),
      email: byline.includes('@') ? byline : null,
      photo: bestThumbnail(active.account_photo),
    });
  } catch (error) {
    console.warn(
      `[google] cookie check failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    return err(GoogleError.InvalidCookies);
  }
}
