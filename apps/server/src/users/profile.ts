import { DEFAULT_LANGUAGE, Language } from '@lyra/shared';
import type { UserProfile } from '@lyra/shared';

import type { User } from '../auth/sessions.ts';

export function toUserProfile(user: User, isGoogleLinked: boolean): UserProfile {
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
  };
}
