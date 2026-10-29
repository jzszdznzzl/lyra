import { z } from 'zod';

export const MailTransport = Object.freeze({
  Smtp: 'smtp',
  // Prints mails to the log instead of sending them, for development and tests.
  Log: 'log',
  // Writes each mail as JSON into DATA_DIR/outbox, so end-to-end tests can follow the links.
  File: 'file',
} as const);

export type MailTransport = (typeof MailTransport)[keyof typeof MailTransport];

export const LogLevel = Object.freeze({
  Fatal: 'fatal',
  Error: 'error',
  Warn: 'warn',
  Info: 'info',
  Debug: 'debug',
  Trace: 'trace',
  Silent: 'silent',
} as const);

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export const LogFormat = Object.freeze({
  // Coloured, one readable line per event: what `pm2 logs` or a terminal wants.
  Pretty: 'pretty',
  // One JSON object per line, for log collectors.
  Json: 'json',
} as const);

export type LogFormat = (typeof LogFormat)[keyof typeof LogFormat];

export const Env = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65_535),
    PUBLIC_URL: z.url(),
    DATA_DIR: z.string().min(1).default('.data'),
    // 32 random bytes in base64. Encrypts stored Google cookies, so losing it unlinks every account.
    SECRET_KEY: z.base64().refine((value) => Buffer.from(value, 'base64').length === 32, {
      message: 'SECRET_KEY must be 32 bytes encoded in base64',
    }),
    // false closes sign-ups: the register endpoint refuses and the app hides the option.
    REGISTRATION_ENABLED: z.stringbool().default(true),
    // Set only when every request comes through Cloudflare (the tunnel); see clientInfo.
    TRUST_PROXY: z.stringbool().default(false),
    // Built web app to serve next to the API; unset in development, where Vite serves it.
    WEB_DIST: z.string().min(1).optional(),
    // Chrome or Chromium installed on the system, for hosts where Playwright's own build fails.
    BROWSER_EXECUTABLE: z.string().min(1).optional(),
    // A Lyra user whose linked Google account fetches audio for users without one. Only playback
    // uses it, never likes, playlists or the library.
    STREAM_FALLBACK_USERNAME: z.string().min(1).optional(),
    // Comma-separated emails of the people who run this server. They get the /admin panel once
    // their email is verified; for everyone else it does not exist (404).
    ADMIN_EMAILS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    // How much the server logs: debug adds every request, info is the normal amount.
    LOG_LEVEL: z.enum(LogLevel).default(LogLevel.Info),
    LOG_FORMAT: z.enum(LogFormat).default(LogFormat.Pretty),
    // Web Push (VAPID) key pair, both or neither: `bunx web-push generate-vapid-keys`. Without
    // them notifications are off and the app hides the option.
    VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    MAIL_TRANSPORT: z.enum(MailTransport).default(MailTransport.Smtp),
    MAIL_FROM: z.string().min(1),
    SMTP_HOST: z.string().default(''),
    SMTP_PORT: z.coerce.number().int().default(465),
    SMTP_USER: z.string().default(''),
    SMTP_PASS: z.string().default(''),
  })
  .refine((env) => (env.VAPID_PUBLIC_KEY === undefined) === (env.VAPID_PRIVATE_KEY === undefined), {
    message: 'Set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, or neither',
  });

export type Env = z.infer<typeof Env>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = Env.safeParse(source);

  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }

  return parsed.data;
}
