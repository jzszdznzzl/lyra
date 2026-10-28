import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { AdminUser, Announcement } from '@lyra/shared';
import type { CreateAnnouncementInput } from '@lyra/shared';

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
