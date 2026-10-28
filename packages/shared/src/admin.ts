import { z } from 'zod';

/** What the admin panel lists about an account: no email, IP, devices or listening history. */
export const AdminUser = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.number(),
  // Last time the account used the app (to the minute); null if it never signed in.
  lastActiveAt: z.number().nullable(),
  isVerified: z.boolean(),
  isGoogleLinked: z.boolean(),
  isSuspended: z.boolean(),
  isAdmin: z.boolean(),
});

export type AdminUser = z.infer<typeof AdminUser>;

export const AdminError = Object.freeze({
  // The test mail could not be sent; the answer carries the SMTP server's reason.
  MailFailed: 'mail_failed',
} as const);

export type AdminError = (typeof AdminError)[keyof typeof AdminError];

export const MailFailure = z.object({
  error: z.literal(AdminError.MailFailed),
  reason: z.string(),
});

export const SMTP_PASSWORD_MAX_LENGTH = 500;

export const FallbackStatus = Object.freeze({
  Off: 'off',
  Ready: 'ready',
  UnknownUser: 'unknown_user',
  NotLinked: 'not_linked',
} as const);

export type FallbackStatus = (typeof FallbackStatus)[keyof typeof FallbackStatus];

/** Settings an admin can change from the panel; the rest stays in the server's env file. */
export const AdminSettings = z.object({
  isRegistrationEnabled: z.boolean(),
  // Lyra user whose Google account plays songs for those without one; null turns it off.
  streamFallbackUsername: z.string().nullable(),
  mailFrom: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number().int(),
  smtpUser: z.string(),
  // The password itself never leaves the server.
  hasSmtpPassword: z.boolean(),
  // How mail is delivered on this server (set in the env file): only "smtp" uses the SMTP fields.
  mailTransport: z.string(),
});

/** The settings plus whether the fallback account can actually play songs. */
export const AdminSettingsView = AdminSettings.extend({ fallbackStatus: z.enum(FallbackStatus) });

export type AdminSettingsView = z.infer<typeof AdminSettingsView>;

export type AdminSettings = z.infer<typeof AdminSettings>;

export const UpdateSettingsInput = z.object({
  isRegistrationEnabled: z.boolean().exactOptional(),
  streamFallbackUsername: z.string().trim().max(20).nullable().exactOptional(),
  mailFrom: z.string().trim().min(3).max(200).exactOptional(),
  smtpHost: z.string().trim().max(253).exactOptional(),
  smtpPort: z.number().int().min(1).max(65_535).exactOptional(),
  smtpUser: z.string().trim().max(254).exactOptional(),
  // Sent only to change it; leaving the field out keeps the current one.
  smtpPassword: z.string().min(1).max(SMTP_PASSWORD_MAX_LENGTH).exactOptional(),
});

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInput>;
