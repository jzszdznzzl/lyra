import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import {
  PasskeyInfo,
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

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => {
    const result = await api('GET', '/me', UserProfile);

    // Signed out is a normal state for this query, not a failure.
    return result.error === ApiError.Unauthorized ? null : unwrap(result);
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

export const logout = () => api('POST', '/auth/logout', NoContent);

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
