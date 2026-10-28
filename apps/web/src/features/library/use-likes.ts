import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { PlaylistPage, Track } from '@lyra/shared';

import { meQuery } from '../auth/api.ts';
import { likedQuery } from '../music/api.ts';
import { likeTrack, unlikeTrack } from './api.ts';

/** Liked state for any track, from the account's Liked songs, updated optimistically. */
export function useLikes() {
  const queryClient = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const canLike = me?.isGoogleLinked ?? false;
  const liked = useQuery({ ...likedQuery, enabled: canLike });
  const likedIds = useMemo(
    () => new Set(liked.data?.tracks.map((track) => track.id)),
    [liked.data],
  );

  async function toggle(track: Track) {
    const isLiked = likedIds.has(track.id);

    queryClient.setQueryData(likedQuery.queryKey, (page: PlaylistPage | undefined) =>
      page
        ? {
            ...page,
            tracks: isLiked
              ? page.tracks.filter((item) => item.id !== track.id)
              : [track, ...page.tracks],
          }
        : page,
    );

    const result = await (isLiked ? unlikeTrack(track.id) : likeTrack(track.id));

    if (result.error) {
      // Put the server's truth back if YouTube refused.
      await queryClient.invalidateQueries({ queryKey: likedQuery.queryKey });
    }
  }

  return { canLike, isLiked: (id: string) => likedIds.has(id), toggle };
}
