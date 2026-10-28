import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

import { AuthenticationResponse, RegistrationResponse, err, ok } from '@lyra/shared';
import type { PasskeyCreationOptions, PasskeyRequestOptions, Result } from '@lyra/shared';

import { ApiError } from '../../lib/api.ts';

// The browser throws when the user cancels the prompt; that is an expected outcome, not a crash.

export async function createPasskey(
  options: PasskeyCreationOptions,
): Promise<Result<RegistrationResponse, ApiError>> {
  try {
    const parsed = RegistrationResponse.safeParse(
      await startRegistration({ optionsJSON: options }),
    );

    return parsed.success ? ok(parsed.data) : err(ApiError.PasskeyFailed);
  } catch {
    return err(ApiError.PasskeyFailed);
  }
}

export async function signWithPasskey(
  options: PasskeyRequestOptions,
): Promise<Result<AuthenticationResponse, ApiError>> {
  try {
    const parsed = AuthenticationResponse.safeParse(
      await startAuthentication({ optionsJSON: options }),
    );

    return parsed.success ? ok(parsed.data) : err(ApiError.PasskeyFailed);
  } catch {
    return err(ApiError.PasskeyFailed);
  }
}

/** Default name for a new passkey, so the list stays readable without asking. */
export function guessDeviceName() {
  const agent = navigator.userAgent;

  if (/Android/.test(agent)) {
    return 'Android';
  }

  if (/iPhone|iPad/.test(agent)) {
    return 'iPhone';
  }

  if (/Windows/.test(agent)) {
    return 'Windows';
  }

  if (/Mac OS X/.test(agent)) {
    return 'Mac';
  }

  return /Linux/.test(agent) ? 'Linux' : 'Passkey';
}
