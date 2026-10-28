import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { Announcement } from '@lyra/shared';

import { api, unwrap } from '../../lib/api.ts';

export const announcementsQuery = queryOptions({
  queryKey: ['announcements'],
  queryFn: async () => unwrap(await api('GET', '/announcements', z.array(Announcement))),
  // Changes arrive through Connect right away; this only covers a dropped connection.
  refetchInterval: 5 * 60 * 1000,
});
