import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { AdminSettingsView, AdminStats, AdminUser, Announcement, MailFailure } from '@lyra/shared';
import type { CreateAnnouncementInput, UpdateSettingsInput } from '@lyra/shared';

import { NoContent, api, unwrap } from '../../lib/api.ts';

const user = (id: string) => `/admin/users/${encodeURIComponent(id)}`;

export const adminUsersQuery = queryOptions({
  queryKey: ['admin', 'users'],
  queryFn: async () => unwrap(await api('GET', '/admin/users', z.array(AdminUser))),
});

export const suspendUser = (id: string) => api('POST', `${user(id)}/suspend`, NoContent);

export const unsuspendUser = (id: string) => api('POST', `${user(id)}/unsuspend`, NoContent);

export const signOutUser = (id: string) => api('POST', `${user(id)}/sign-out`, NoContent);

export const deleteUser = (id: string) => api('DELETE', user(id), NoContent);

export const adminAnnouncementsQuery = queryOptions({
  queryKey: ['admin', 'announcements'],
  queryFn: async () => unwrap(await api('GET', '/admin/announcements', z.array(Announcement))),
});

export const publishAnnouncement = (input: CreateAnnouncementInput) =>
  api('POST', '/admin/announcements', Announcement, input);

export const endAnnouncement = (id: string) =>
  api('DELETE', `/admin/announcements/${encodeURIComponent(id)}`, NoContent);

export const adminSettingsQuery = queryOptions({
  queryKey: ['admin', 'settings'],
  queryFn: async () => unwrap(await api('GET', '/admin/settings', AdminSettingsView)),
});

export const updateSettings = (input: UpdateSettingsInput) =>
  api('PATCH', '/admin/settings', AdminSettingsView, input);

/** Sends a test mail to the admin; resolves to the SMTP server's complaint when it fails. */
export async function sendTestMail(): Promise<{ isSent: boolean; reason: string | null }> {
  try {
    const response = await fetch('/api/admin/settings/test-mail', {
      method: 'POST',
      credentials: 'same-origin',
    });

    if (response.ok) {
      return { isSent: true, reason: null };
    }

    const failure = MailFailure.safeParse(await response.json().catch(() => null));

    return { isSent: false, reason: failure.success ? failure.data.reason : null };
  } catch {
    return { isSent: false, reason: null };
  }
}

export const adminStatsQuery = (days: number) =>
  queryOptions({
    queryKey: ['admin', 'stats', days],
    queryFn: async () => {
      // Days cut at the admin's own midnight: getTimezoneOffset is minutes behind UTC.
      const offset = -new Date().getTimezoneOffset();

      return unwrap(await api('GET', `/admin/stats?days=${days}&offset=${offset}`, AdminStats));
    },
    refetchInterval: 60 * 1000,
  });
