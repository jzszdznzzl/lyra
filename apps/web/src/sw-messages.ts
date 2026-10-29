import { z } from 'zod';

/** From the service worker to an open page: show this path (a tapped notification). */
export const OpenPathMessage = z.object({
  type: z.literal('open-path'),
  path: z.string().startsWith('/'),
});

export type OpenPathMessage = z.infer<typeof OpenPathMessage>;
