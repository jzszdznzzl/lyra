import { z } from 'zod';

import { Language } from './i18n.ts';

export const AuthError = Object.freeze({
  InvalidCredentials: 'invalid_credentials',
  EmailNotVerified: 'email_not_verified',
  EmailTaken: 'email_taken',
  UsernameTaken: 'username_taken',
  DisposableEmail: 'disposable_email',
  WeakPassword: 'weak_password',
  InvalidToken: 'invalid_token',
  Unauthorized: 'unauthorized',
  TooManyRequests: 'too_many_requests',
  PasskeyFailed: 'passkey_failed',
  NotFound: 'not_found',
  InvalidImage: 'invalid_image',
  RegistrationClosed: 'registration_closed',
  TooManyTokens: 'too_many_tokens',
  AccountSuspended: 'account_suspended',
  // Admins cannot suspend or delete themselves or another admin.
  ProtectedAccount: 'protected_account',
} as const);

export type AuthError = (typeof AuthError)[keyof typeof AuthError];

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
// zxcvbn scores go from 0 to 4; 3 means "safely unguessable" against offline attacks with a slow hash.
export const PASSWORD_MIN_SCORE = 3;
export const NAME_MAX_LENGTH = 60;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const Email = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, 'username must be 3-20 lowercase letters, numbers or underscores');

export const DisplayName = z.string().trim().min(1).max(NAME_MAX_LENGTH);

export const Password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const RegisterInput = z.object({
  email: Email,
  username: Username,
  name: DisplayName,
  password: Password,
  language: z.enum(Language).exactOptional(),
});

export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  // Email or username.
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type LoginInput = z.infer<typeof LoginInput>;

export const TokenInput = z.object({ token: z.string().min(1).max(200) });

export type TokenInput = z.infer<typeof TokenInput>;

export const EmailInput = z.object({ email: Email });

export type EmailInput = z.infer<typeof EmailInput>;

export const ResetPasswordInput = z.object({
  token: z.string().min(1).max(200),
  password: Password,
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: Password,
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export const DeleteAccountInput = z.object({
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type DeleteAccountInput = z.infer<typeof DeleteAccountInput>;

export const UpdateProfileInput = z.object({
  name: DisplayName.exactOptional(),
  language: z.enum(Language).exactOptional(),
  isYoutubeHistoryEnabled: z.boolean().exactOptional(),
  isNowPlayingPublic: z.boolean().exactOptional(),
  isRecentSharedWithFriends: z.boolean().exactOptional(),
  isNowPlayingSharedWithFriends: z.boolean().exactOptional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;

export const UserProfile = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  name: z.string(),
  language: z.enum(Language),
  avatarUrl: z.string().nullable(),
  isGoogleLinked: z.boolean(),
  // Songs played past a threshold are added to the linked YouTube account's history.
  isYoutubeHistoryEnabled: z.boolean(),
  // Anyone can see the current or last song through the public widget.
  isNowPlayingPublic: z.boolean(),
  // Friends can see the songs heard lately, read from the YouTube history.
  isRecentSharedWithFriends: z.boolean(),
  // Friends can see the song playing now (or the last one, for a day).
  isNowPlayingSharedWithFriends: z.boolean(),
  // Only present for admins, so other accounts never see the field.
  isAdmin: z.literal(true).exactOptional(),
});

export type UserProfile = z.infer<typeof UserProfile>;

export const SessionInfo = z.object({
  id: z.string(),
  device: z.string(),
  ip: z.string(),
  createdAt: z.number(),
  lastSeenAt: z.number(),
  isCurrent: z.boolean(),
});

export type SessionInfo = z.infer<typeof SessionInfo>;

export const PasskeyInfo = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  lastUsedAt: z.number().nullable(),
  isBackedUp: z.boolean(),
});

export type PasskeyInfo = z.infer<typeof PasskeyInfo>;

export const RenamePasskeyInput = z.object({ name: z.string().trim().min(1).max(60) });

export type RenamePasskeyInput = z.infer<typeof RenamePasskeyInput>;

const AuthenticatorAttachment = z.enum(['cross-platform', 'platform']);

const ClientExtensionResults = z.object({
  appid: z.boolean().exactOptional(),
  credProps: z.object({ rk: z.boolean().exactOptional() }).exactOptional(),
  hmacCreateSecret: z.boolean().exactOptional(),
});

export const RegistrationResponse = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
    authenticatorData: z.string().exactOptional(),
    transports: z.array(z.string()).exactOptional(),
    publicKeyAlgorithm: z.number().exactOptional(),
    publicKey: z.string().exactOptional(),
  }),
  authenticatorAttachment: AuthenticatorAttachment.exactOptional(),
  clientExtensionResults: ClientExtensionResults,
  type: z.literal('public-key'),
});

export type RegistrationResponse = z.infer<typeof RegistrationResponse>;

export const AuthenticationResponse = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().exactOptional(),
  }),
  authenticatorAttachment: AuthenticatorAttachment.exactOptional(),
  clientExtensionResults: ClientExtensionResults,
  type: z.literal('public-key'),
});

export type AuthenticationResponse = z.infer<typeof AuthenticationResponse>;

export const PasskeyRegistrationInput = z.object({
  challengeId: z.string(),
  name: z.string().trim().min(1).max(60).exactOptional(),
  response: RegistrationResponse,
});

export type PasskeyRegistrationInput = z.infer<typeof PasskeyRegistrationInput>;

export const PasskeyLoginInput = z.object({
  challengeId: z.string(),
  response: AuthenticationResponse,
});

export type PasskeyLoginInput = z.infer<typeof PasskeyLoginInput>;

/** Public settings the app needs before anyone signs in. */
export const PublicConfig = z.object({ isRegistrationEnabled: z.boolean() });

export type PublicConfig = z.infer<typeof PublicConfig>;
