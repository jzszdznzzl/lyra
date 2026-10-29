import { DEFAULT_LANGUAGE, Language } from '@lyra/shared';
import type { UserProfile } from '@lyra/shared';

import { isAdmin } from '../admin/admins.ts';
import type { User } from '../auth/sessions.ts';
import type { AppContext } from '../context.ts';

export function toUserProfile(ctx: AppContext, user: User, isGoogleLinked: boolean): UserProfile {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    language:
      Object.values(Language).find((language) => language === user.language) ?? DEFAULT_LANGUAGE,
    avatarUrl:
      user.avatarVersion === null ? null : `/api/avatars/${user.id}.webp?v=${user.avatarVersion}`,
    isGoogleLinked,
    isYoutubeHistoryEnabled: user.isYoutubeHistoryEnabled,
    isNowPlayingPublic: user.isNowPlayingPublic,
    isRecentSharedWithFriends: user.isRecentSharedWithFriends,
    ...(isAdmin(ctx, user) ? { isAdmin: true as const } : {}),
  };
}
