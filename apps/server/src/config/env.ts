import { z } from 'zod';

export const MailTransport = Object.freeze({
  Smtp: 'smtp',
  // Prints mails to the log instead of sending them, for development and tests.
  Log: 'log',
  // Writes each mail as JSON into DATA_DIR/outbox, so end-to-end tests can follow the links.
  File: 'file',
} as const);

export type MailTransport = (typeof MailTransport)[keyof typeof MailTransport];

export const Env = z.object({
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
  MAIL_TRANSPORT: z.enum(MailTransport).default(MailTransport.Smtp),
  MAIL_FROM: z.string().min(1),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
});

export type Env = z.infer<typeof Env>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = Env.safeParse(source);

  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }

  return parsed.data;
}
