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

/** Things the server counts per hour for the statistics. */
export const StatEvent = Object.freeze({
  // A song started with the listener's own Google account.
  StreamOwn: 'stream.own',
  // A song started without an account.
  StreamAnonymous: 'stream.anonymous',
  // A song started through the fallback account.
  StreamFallback: 'stream.fallback',
  // YouTube asked for a Google account and none could play it.
  StreamGoogleRequired: 'stream.google_required',
  // Any other failure to start a song.
  StreamError: 'stream.error',
  WidgetView: 'widget.view',
  ApiRequest: 'api.now_playing',
} as const);

export type StatEvent = (typeof StatEvent)[keyof typeof StatEvent];

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

export const STATS_RANGES = [7, 30, 90, 365] as const;

export const StatsQuery = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((days) => STATS_RANGES.some((range) => range === days)),
  // The admin's offset from UTC in minutes (UTC-3 → -180), so days start at their midnight.
  offset: z.coerce
    .number()
    .int()
    .min(-14 * 60)
    .max(14 * 60),
});

export type StatsQuery = z.infer<typeof StatsQuery>;

export const StatsDay = z.object({
  day: z.string(),
  signups: z.number(),
  activeUsers: z.number(),
  plays: z.number(),
  listeners: z.number(),
  streamOwn: z.number(),
  streamAnonymous: z.number(),
  streamFallback: z.number(),
  streamGoogleRequired: z.number(),
  streamErrors: z.number(),
  widgetViews: z.number(),
  apiRequests: z.number(),
});

export type StatsDay = z.infer<typeof StatsDay>;

/** Server-wide totals for the admin panel; nothing in it belongs to one person. */
export const AdminStats = z.object({
  days: z.number(),
  totals: z.object({
    users: z.number(),
    verified: z.number(),
    suspended: z.number(),
    googleLinked: z.number(),
    admins: z.number(),
    apiTokens: z.number(),
    publicWidgets: z.number(),
    onlineNow: z.number(),
    playsAllTime: z.number(),
  }),
  period: z.object({
    plays: z.number(),
    listeners: z.number(),
    activeUsers: z.number(),
    signups: z.number(),
    // Estimated from the length of the songs played.
    minutesPlayed: z.number(),
  }),
  daily: z.array(StatsDay),
  playsByHour: z.array(z.number()).length(24),
  topTracks: z.array(
    z.object({ videoId: z.string(), title: z.string(), artists: z.string(), plays: z.number() }),
  ),
  topArtists: z.array(z.object({ name: z.string(), plays: z.number() })),
  storage: z.object({ databaseBytes: z.number(), images: z.number() }),
});

export type AdminStats = z.infer<typeof AdminStats>;
