import { z } from 'zod';

export const GoogleLinkMethod = Object.freeze({
  Browser: 'browser',
  Cookies: 'cookies',
} as const);

export type GoogleLinkMethod = (typeof GoogleLinkMethod)[keyof typeof GoogleLinkMethod];

export const GoogleError = Object.freeze({
  InvalidCookies: 'invalid_cookies',
  NotSignedIn: 'not_signed_in',
  BrowserUnavailable: 'browser_unavailable',
  BrowserBusy: 'browser_busy',
} as const);

export type GoogleError = (typeof GoogleError)[keyof typeof GoogleError];

export const GoogleAccount = z.object({
  name: z.string(),
  email: z.string().nullable(),
  photo: z.string().nullable(),
  method: z.enum(GoogleLinkMethod),
  linkedAt: z.number(),
});

export type GoogleAccount = z.infer<typeof GoogleAccount>;

export const GoogleStatus = z.object({ account: GoogleAccount.nullable() });

export type GoogleStatus = z.infer<typeof GoogleStatus>;

export const CookieLinkInput = z.object({
  // The raw `Cookie` header copied from a signed-in music.youtube.com request.
  cookie: z.string().trim().min(20).max(16_384),
});

export type CookieLinkInput = z.infer<typeof CookieLinkInput>;

// --- Remote browser protocol (WebSocket /api/google/browser) ---

export const BrowserViewport = Object.freeze({ Width: 412, Height: 780 } as const);

export const BrowserClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('scroll'), deltaY: z.number() }),
  z.object({ type: z.literal('text'), text: z.string().max(1000) }),
  z.object({ type: z.literal('key'), key: z.string().max(40) }),
  z.object({ type: z.literal('cancel') }),
]);

export type BrowserClientMessage = z.infer<typeof BrowserClientMessage>;

export const BrowserServerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('frame'), data: z.string() }),
  z.object({ type: z.literal('linked'), account: GoogleAccount }),
  z.object({ type: z.literal('error'), error: z.enum(GoogleError) }),
]);

export type BrowserServerMessage = z.infer<typeof BrowserServerMessage>;
