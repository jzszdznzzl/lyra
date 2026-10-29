import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { FriendStatus, FriendsOverview, UserMusic, UserPage } from '@lyra/shared';
import type { CreateSharedPlaylistInput } from '@lyra/shared';

import { NoContent, api, unwrap } from '../../lib/api.ts';

const MINUTE_MS = 60 * 1000;
const FriendAnswer = z.object({ status: z.enum(FriendStatus) });
const Created = z.object({ id: z.string() });

const path = (value: string) => encodeURIComponent(value);

export const friendsQuery = queryOptions({
  queryKey: ['social', 'friends'],
  queryFn: async () => unwrap(await api('GET', '/social/friends', FriendsOverview)),
  // Requests and invitations should show up without a reload.
  staleTime: MINUTE_MS,
  refetchInterval: 2 * MINUTE_MS,
});

export const userPageQuery = (username: string) =>
  queryOptions({
    queryKey: ['social', 'user', username],
    queryFn: async () => unwrap(await api('GET', `/social/users/${path(username)}`, UserPage)),
    staleTime: 30 * 1000,
  });

export const userMusicQuery = (username: string) =>
  queryOptions({
    queryKey: ['social', 'user', username, 'music'],
    queryFn: async () =>
      unwrap(await api('GET', `/social/users/${path(username)}/music`, UserMusic)),
    staleTime: 2 * MINUTE_MS,
  });

export function addFriend(username: string) {
  return api('POST', `/social/friends/${path(username)}`, FriendAnswer);
}

export function removeFriend(username: string) {
  return api('DELETE', `/social/friends/${path(username)}`, NoContent);
}

export function createSharedPlaylist(input: CreateSharedPlaylistInput) {
  return api('POST', '/social/playlists', Created, input);
}

export function joinSharedPlaylist(id: string) {
  return api('POST', `/social/playlists/${path(id)}/join`, NoContent);
}

export function declineSharedPlaylist(id: string) {
  return api('DELETE', `/social/playlists/${path(id)}/invite`, NoContent);
}
