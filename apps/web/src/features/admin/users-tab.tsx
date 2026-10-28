import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Crown, LogOut, MoreHorizontal, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AdminUser } from '@lyra/shared';

import { formatRelative } from '../../lib/format.ts';
import { Avatar } from '../../ui/avatar.tsx';
import { Menu } from '../../ui/menu.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { useToast } from '../../ui/toast.tsx';
import { useErrorText } from '../auth/use-error-text.ts';
import { adminUsersQuery, deleteUser, signOutUser, suspendUser, unsuspendUser } from './api.ts';
import type { ApiError } from '../../lib/api.ts';
import type { MenuItem } from '../../ui/menu.tsx';

const BadgeTone = Object.freeze({ Muted: 'muted', Danger: 'danger', Success: 'success' } as const);

type BadgeTone = (typeof BadgeTone)[keyof typeof BadgeTone];

const BADGE_CLASSES: Record<BadgeTone, string> = {
  [BadgeTone.Muted]: 'bg-surface-2 text-muted',
  [BadgeTone.Danger]: 'bg-danger/10 text-danger',
  [BadgeTone.Success]: 'bg-success/10 text-success',
};

function Badge({ tone, children }: { tone: BadgeTone; children: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BADGE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

function UserActions({
  user,
  onDone,
}: {
  user: AdminUser;
  onDone: (error: ApiError | null) => void;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  async function run(action: () => Promise<{ error: ApiError | null }>) {
    onDone((await action()).error);
  }

  const items: MenuItem[] = [
    user.isSuspended
      ? {
          label: t('admin.users.unsuspend'),
          icon: <RotateCcw className="size-4" />,
          onSelect: () => void run(() => unsuspendUser(user.id)),
        }
      : {
          label: t('admin.users.suspend'),
          icon: <Ban className="size-4" />,
          onSelect: () => {
            if (window.confirm(t('admin.users.suspendConfirm', { name: user.name }))) {
              void run(() => suspendUser(user.id));
            }
          },
        },
    {
      label: t('admin.users.signOut'),
      icon: <LogOut className="size-4" />,
      onSelect: () => void run(() => signOutUser(user.id)),
    },
    {
      label: t('admin.users.delete'),
      icon: <Trash2 className="size-4" />,
      isDanger: true,
      onSelect: () => {
        if (window.confirm(t('admin.users.deleteConfirm', { name: user.name }))) {
          void run(() => deleteUser(user.id));
        }
      },
    },
  ];

  return (
    <>
      <button
        type="button"
        aria-label={t('admin.users.actions', { name: user.name })}
        aria-haspopup="menu"
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
        className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-text"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {anchor ? <Menu anchor={anchor} items={items} onClose={() => setAnchor(null)} /> : null}
    </>
  );
}

export function UsersTab() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const showToast = useToast((state) => state.show);
  const users = useQuery(adminUsersQuery);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const needle = filter.trim().toLowerCase();
  const shown = (users.data ?? []).filter(
    (user) =>
      needle === '' || user.name.toLowerCase().includes(needle) || user.username.includes(needle),
  );

  async function done(result: ApiError | null) {
    setError(result);

    if (!result) {
      showToast(t('admin.users.done'));
    }

    await queryClient.invalidateQueries({ queryKey: adminUsersQuery.queryKey });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">
          {t('admin.users.title', { count: users.data?.length ?? 0 })}
        </h2>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t('admin.users.filter')}
            className="h-10 w-56 rounded-full border border-line bg-surface-2 pr-4 pl-9 text-sm outline-none focus:border-accent"
          />
        </label>
      </header>
      {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
      <ul className="flex flex-col divide-y divide-line">
        {shown.map((user) => (
          <li key={user.id} className="flex items-center gap-3 py-3">
            <Avatar name={user.name} url={user.avatarUrl} size={44} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-bold">{user.name}</span>
                {user.isAdmin ? (
                  <Crown
                    aria-label={t('profile.admin')}
                    className="size-4 fill-amber-400 text-amber-500"
                  />
                ) : null}
                {user.isSuspended ? (
                  <Badge tone={BadgeTone.Danger}>{t('admin.users.suspended')}</Badge>
                ) : null}
                {user.isVerified ? null : (
                  <Badge tone={BadgeTone.Muted}>{t('admin.users.unverified')}</Badge>
                )}
                {user.isGoogleLinked ? <Badge tone={BadgeTone.Success}>Google</Badge> : null}
              </p>
              <p className="truncate text-xs text-muted">
                @{user.username} ·{' '}
                {t('admin.users.joined', { date: formatRelative(user.createdAt, i18n.language) })}
                {' · '}
                {user.lastActiveAt
                  ? t('admin.users.active', {
                      date: formatRelative(user.lastActiveAt, i18n.language),
                    })
                  : t('admin.users.neverActive')}
              </p>
            </div>
            {user.isAdmin ? null : (
              <UserActions user={user} onDone={(result) => void done(result)} />
            )}
          </li>
        ))}
      </ul>
      {users.data && shown.length === 0 ? (
        <p className="text-sm text-muted">{t('admin.users.none')}</p>
      ) : null}
    </section>
  );
}
