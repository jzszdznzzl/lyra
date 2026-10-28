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
