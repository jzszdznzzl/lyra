import { z } from 'zod';

/** What a personal token may do. Tokens carry a list, so new permissions need no migration. */
export const TokenScope = Object.freeze({
  NowPlayingRead: 'now-playing:read',
} as const);

export type TokenScope = (typeof TokenScope)[keyof typeof TokenScope];

export const TOKEN_NAME_MAX_LENGTH = 60;
export const MAX_API_TOKENS = 20;
// Shown in front of every token, so a leaked one is easy to recognize (and to scan for).
export const API_TOKEN_PREFIX = 'lyra_';

export const ApiTokenInfo = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.enum(TokenScope)),
  createdAt: z.number(),
  lastUsedAt: z.number().nullable(),
});

export type ApiTokenInfo = z.infer<typeof ApiTokenInfo>;

export const CreateApiTokenInput = z.object({
  name: z.string().trim().min(1).max(TOKEN_NAME_MAX_LENGTH),
});

export type CreateApiTokenInput = z.infer<typeof CreateApiTokenInput>;

/** The secret is only ever shown here, right after creating it; the server keeps its hash. */
export const CreatedApiToken = z.object({
  token: z.string(),
  info: ApiTokenInfo,
});

export type CreatedApiToken = z.infer<typeof CreatedApiToken>;
