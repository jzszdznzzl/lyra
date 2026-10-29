import { Language } from '@lyra/shared';
import type { PushMessage } from '@lyra/shared';

export const PushKind = Object.freeze({
  FriendRequest: 'friend_request',
  FriendAccepted: 'friend_accepted',
  PlaylistInvite: 'playlist_invite',
} as const);

export type PushKind = (typeof PushKind)[keyof typeof PushKind];

export type PushNotice =
  | { kind: typeof PushKind.FriendRequest; name: string; username: string }
  | { kind: typeof PushKind.FriendAccepted; name: string; username: string }
  | { kind: typeof PushKind.PlaylistInvite; name: string; title: string };

const TEXTS = {
  [Language.English]: {
    [PushKind.FriendRequest]: (name: string) => ({
      title: 'New friend request',
      body: `${name} wants to be your friend on Lyra.`,
    }),
    [PushKind.FriendAccepted]: (name: string) => ({
      title: 'Friend request accepted',
      body: `${name} and you are now friends.`,
    }),
    [PushKind.PlaylistInvite]: (name: string, title: string) => ({
      title: 'Playlist invitation',
      body: `${name} invited you to “${title}”.`,
    }),
  },
  [Language.Spanish]: {
    [PushKind.FriendRequest]: (name: string) => ({
      title: 'Nueva solicitud de amistad',
      body: `${name} quiere ser tu amigo en Lyra.`,
    }),
    [PushKind.FriendAccepted]: (name: string) => ({
      title: 'Solicitud aceptada',
      body: `${name} y tú ahora son amigos.`,
    }),
    [PushKind.PlaylistInvite]: (name: string, title: string) => ({
      title: 'Invitación a una playlist',
      body: `${name} te invitó a «${title}».`,
    }),
  },
} as const satisfies Record<Language, unknown>;

/** The notification in the recipient's language, with where tapping it leads. */
export function pushMessage(notice: PushNotice, language: Language): PushMessage {
  const texts = TEXTS[language];

  switch (notice.kind) {
    case PushKind.FriendRequest: {
      return {
        ...texts[notice.kind](notice.name),
        url: '/friends',
        tag: `friend-${notice.username}`,
      };
    }
    case PushKind.FriendAccepted: {
      return {
        ...texts[notice.kind](notice.name),
        url: `/user/${encodeURIComponent(notice.username)}`,
        tag: `friend-${notice.username}`,
      };
    }
    case PushKind.PlaylistInvite: {
      return {
        ...texts[notice.kind](notice.name, notice.title),
        url: '/friends',
        tag: `invite-${notice.title}`,
      };
    }
    default: {
      return notice satisfies never;
    }
  }
}
