import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { UserCard } from '@lyra/shared';

import { Avatar } from '../../ui/avatar.tsx';

export function UserRow({ user, children }: { user: UserCard; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface">
      <Link
        to="/user/$username"
        params={{ username: user.username }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar name={user.name} url={user.avatarUrl} size={44} />
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold">{user.name}</span>
          <span className="block truncate text-[13px] text-muted">@{user.username}</span>
        </span>
      </Link>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </li>
  );
}
