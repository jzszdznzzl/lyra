import type { z } from 'zod';

export const INVALID_QUERY = { type: 'validation', on: 'query' } as const;

/**
 * Elysia splits every comma-separated query value into an array when a Standard Schema
 * validates the query, so "Hello, Goodbye" would fail. Routes parse the raw query instead.
 */
export function parseQuery<S extends z.ZodType>(
  schema: S,
  query: Record<string, string | undefined>,
) {
  const parsed = schema.safeParse(query);

  return parsed.success ? parsed.data : null;
}
