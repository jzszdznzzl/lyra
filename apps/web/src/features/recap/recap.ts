import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { Recap } from '@lyra/shared';

import { api, unwrap } from '../../lib/api.ts';

export const RecapSearch = z.object({
  year: z.coerce.number().int().min(2000).max(9999).optional().catch(undefined),
});

export const recapQuery = (year: number) =>
  queryOptions({
    queryKey: ['recap', year],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(year),
        offset: String(utcOffsetMinutes()),
      });

      return unwrap(await api('GET', `/me/recap?${params.toString()}`, Recap));
    },
    staleTime: 5 * 60 * 1000,
  });

/** Minutes to add to UTC for this device's time, as the server expects. */
export function utcOffsetMinutes(date = new Date()) {
  return -date.getTimezoneOffset();
}

/** The index of the largest value, or null when every value is zero. */
export function peakIndex(values: readonly number[]) {
  let best: number | null = null;

  for (const [index, value] of values.entries()) {
    if (value > 0 && (best === null || value > (values[best] ?? 0))) {
      best = index;
    }
  }

  return best;
}
