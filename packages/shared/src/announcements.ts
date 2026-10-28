import { z } from 'zod';

export const AnnouncementLevel = Object.freeze({ Info: 'info', Warning: 'warning' } as const);

export type AnnouncementLevel = (typeof AnnouncementLevel)[keyof typeof AnnouncementLevel];

export const ANNOUNCEMENT_MAX_LENGTH = 500;
// From five minutes to a month: long enough for maintenance notes, short enough to not linger.
export const ANNOUNCEMENT_MIN_MINUTES = 5;
export const ANNOUNCEMENT_MAX_MINUTES = 30 * 24 * 60;

export const Announcement = z.object({
  id: z.string(),
  message: z.string(),
  level: z.enum(AnnouncementLevel),
  createdAt: z.number(),
  expiresAt: z.number(),
});

export type Announcement = z.infer<typeof Announcement>;

export const CreateAnnouncementInput = z.object({
  message: z.string().trim().min(1).max(ANNOUNCEMENT_MAX_LENGTH),
  level: z.enum(AnnouncementLevel),
  durationMinutes: z.number().int().min(ANNOUNCEMENT_MIN_MINUTES).max(ANNOUNCEMENT_MAX_MINUTES),
});

export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementInput>;
