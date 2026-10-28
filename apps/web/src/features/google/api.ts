import { queryOptions } from '@tanstack/react-query';

import { GoogleStatus } from '@lyra/shared';

import { NoContent, api, unwrap } from '../../lib/api.ts';

export const googleQuery = queryOptions({
  queryKey: ['google'],
  queryFn: async () => unwrap(await api('GET', '/google', GoogleStatus)),
});

export const linkWithCookies = (cookie: string) =>
  api('POST', '/google/cookies', GoogleStatus, { cookie });

export const unlinkGoogle = () => api('DELETE', '/google', NoContent);
