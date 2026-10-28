import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import {
  PasskeyInfo,
  PublicConfig,
  PasskeyLoginStart,
  PasskeyRegistrationStart,
  SessionInfo,
  UserProfile,
} from '@lyra/shared';
import type {
  AuthenticationResponse,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  RegistrationResponse,
  UpdateProfileInput,
} from '@lyra/shared';

import { ApiError, NoContent, api, unwrap } from '../../lib/api.ts';

const Registered = z.object({ email: z.string() });

const PROFILE_KEY = 'lyra.profile';

function readCachedProfile() {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');

    return UserProfile.safeParse(stored).data ?? null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: UserProfile | null) {
  try {
    if (profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_KEY);
    }
  } catch {
    // Storage can be blocked; the app then simply needs the network to start.
  }
}

export const configQuery = queryOptions({
  queryKey: ['config'],
  queryFn: async () => {
    const result = await api('GET', '/config', PublicConfig);

    // Offline nobody signs up anyway; assume the usual setting.
    return result.data ?? { isRegistrationEnabled: true };
  },
  staleTime: Number.POSITIVE_INFINITY,
});

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => {
    const result = await api('GET', '/me', UserProfile);

    // Offline, the last known profile keeps the app (and its downloads) usable.
    if (result.error === ApiError.Network) {
      return readCachedProfile() ?? unwrap(result);
    }

    // Signed out is a normal state for this query, not a failure.
    if (result.error === ApiError.Unauthorized) {
      writeCachedProfile(null);

      return null;
    }

    writeCachedProfile(result.data);

    return unwrap(result);
  },
  staleTime: 5 * 60 * 1000,
});

export const sessionsQuery = queryOptions({
  queryKey: ['sessions'],
  queryFn: async () => unwrap(await api('GET', '/sessions', z.array(SessionInfo))),
});

export const passkeysQuery = queryOptions({
  queryKey: ['passkeys'],
  queryFn: async () => unwrap(await api('GET', '/passkeys', z.array(PasskeyInfo))),
});

export const register = (input: RegisterInput) => api('POST', '/auth/register', Registered, input);

export const login = (input: LoginInput) => api('POST', '/auth/login', UserProfile, input);

export async function logout() {
  // Otherwise an offline start would still show the signed-out account.
  writeCachedProfile(null);

  return api('POST', '/auth/logout', NoContent);
}

export const verifyEmail = (token: string) =>
  api('POST', '/auth/verify-email', UserProfile, { token });

export const resendVerification = (email: string) =>
  api('POST', '/auth/resend-verification', NoContent, { email });

export const forgotPassword = (email: string) =>
  api('POST', '/auth/forgot-password', NoContent, { email });

export const resetPassword = (token: string, password: string) =>
  api('POST', '/auth/reset-password', NoContent, { token, password });

export const startPasskeyLogin = () => api('POST', '/auth/passkey/options', PasskeyLoginStart, {});

export const finishPasskeyLogin = (challengeId: string, response: AuthenticationResponse) =>
  api('POST', '/auth/passkey/verify', UserProfile, { challengeId, response });

export const updateProfile = (input: UpdateProfileInput) => api('PATCH', '/me', UserProfile, input);

export async function deleteAccount(password: string) {
  const result = await api('DELETE', '/me', NoContent, { password });

  if (!result.error) {
    writeCachedProfile(null);
  }

  return result;
}

export const changePassword = (input: ChangePasswordInput) =>
  api('POST', '/me/password', NoContent, input);

export function uploadAvatar(file: File) {
  const form = new FormData();
  form.set('file', file);

  return api('PUT', '/me/avatar', UserProfile, form);
}

export const removeAvatar = () => api('DELETE', '/me/avatar', UserProfile);

export const revokeSession = (id: string) =>
  api('DELETE', `/sessions/${encodeURIComponent(id)}`, NoContent);

export const revokeOtherSessions = () => api('DELETE', '/sessions', NoContent);

export const startPasskeyRegistration = () =>
  api('POST', '/passkeys/options', PasskeyRegistrationStart);

export const finishPasskeyRegistration = (
  challengeId: string,
  response: RegistrationResponse,
  name: string,
) => api('POST', '/passkeys', PasskeyInfo, { challengeId, response, name });

export const renamePasskey = (id: string, name: string) =>
  api('PATCH', `/passkeys/${encodeURIComponent(id)}`, NoContent, { name });

export const deletePasskey = (id: string) =>
  api('DELETE', `/passkeys/${encodeURIComponent(id)}`, NoContent);
