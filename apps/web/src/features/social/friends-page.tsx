import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, ListMusic, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { FriendStatus, SocialError } from '@lyra/shared';
import type { PlaylistInvite } from '@lyra/shared';

import { useDocumentTitle } from '../../lib/use-document-title.ts';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { Page } from '../../ui/page.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { useToast } from '../../ui/toast.tsx';
import { meQuery } from '../auth/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { libraryPlaylistsQuery } from '../music/api.ts';
import { ErrorState, LoadingState } from '../music/query-state.tsx';
import {
  addFriend,
  declineSharedPlaylist,
  friendsQuery,
  joinSharedPlaylist,
  removeFriend,
} from './api.ts';
import { UserRow } from './user-row.tsx';
import type { ApiError } from '../../lib/api.ts';

const CREATE_CHANNEL_URL = 'https://www.youtube.com/create_channel';
// Usernames are lowercase; people often type them with a leading @.
const USERNAME_PREFIX = /^@/;

function InviteRow({ invite }: { invite: PlaylistInvite }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const showToast = useToast((state) => state.show);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: friendsQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: libraryPlaylistsQuery.queryKey }),
    ]);
  }

  async function join() {
    setIsBusy(true);
    const result = await joinSharedPlaylist(invite.playlistId);
    setIsBusy(false);
    setError(result.error);

    if (!result.error) {
      showToast(t('social.joined', { title: invite.title }));
      await refresh();
    }
  }

  async function decline() {
    await declineSharedPlaylist(invite.playlistId);
    await refresh();
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2">
          <ListMusic className="size-5 text-white" />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          {t('social.inviteText', { name: invite.from.name, title: invite.title })}
        </p>
      </div>
      {error === SocialError.NeedsChannel ? (
        <Notice tone={NoticeTone.Info}>
          {t('social.needsChannel')}{' '}
          <a href={CREATE_CHANNEL_URL} target="_blank" rel="noreferrer" className="underline">
            {t('social.createChannel')}
          </a>
        </Notice>
      ) : error ? (
        <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice>
      ) : null}
      <div className="flex gap-2">
        <Button isBusy={isBusy} onClick={() => void join()}>
          <Check className="size-4" />
          {t('social.join')}
        </Button>
        <Button variant={ButtonVariant.Ghost} onClick={() => void decline()}>
          {t('social.decline')}
        </Button>
      </div>
    </li>
  );
}

function AddFriendForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const showToast = useToast((state) => state.show);
  const [username, setUsername] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const wanted = username.trim().replace(USERNAME_PREFIX, '').toLowerCase();

    if (wanted === '') {
      return;
    }

    setIsBusy(true);
    const result = await addFriend(wanted);
    setIsBusy(false);
    setError(result.error);

    if (result.data) {
      setUsername('');
      showToast(
        t(
          result.data.status === FriendStatus.Friends ? 'social.nowFriends' : 'social.requestSent',
          { username: wanted },
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ['social'] });
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex items-end gap-2">
      <TextField
        className="flex-1"
        label={t('social.addLabel')}
        placeholder={t('social.addPlaceholder')}
        value={username}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => setUsername(event.target.value)}
        error={errorText(error)}
      />
      <Button
        type="submit"
        isBusy={isBusy}
        disabled={username.trim() === ''}
        aria-label={t('social.add')}
      >
        <UserPlus className="size-4" />
        <span className="hidden sm:inline">{t('social.add')}</span>
      </Button>
    </form>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-[19px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function FriendsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const friends = useQuery(friendsQuery);
  useDocumentTitle(t('social.title'));

  async function remove(username: string) {
    await removeFriend(username);
    await queryClient.invalidateQueries({ queryKey: ['social'] });
  }

  async function accept(username: string) {
    await addFriend(username);
    await queryClient.invalidateQueries({ queryKey: ['social'] });
  }

  const data = friends.data;
  const isEmpty =
    data !== undefined &&
    data.friends.length + data.incoming.length + data.outgoing.length + data.invites.length === 0;

  return (
    <Page>
      <h1 className="mt-6 mb-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t('social.title')}
      </h1>
      {me ? (
        <p className="mb-5 text-sm text-muted">
          {t('social.yourUsername')}{' '}
          <Link
            to="/user/$username"
            params={{ username: me.username }}
            className="font-semibold text-text hover:underline"
          >
            @{me.username}
          </Link>
        </p>
      ) : null}
      <AddFriendForm />
      {friends.isPending ? <LoadingState /> : null}
      {friends.isError ? (
        <ErrorState error={friends.error} onRetry={() => void friends.refetch()} />
      ) : null}
      {isEmpty ? <p className="mt-8 text-sm text-muted">{t('social.empty')}</p> : null}
      {data && data.invites.length > 0 ? (
        <Group title={t('social.invites')}>
          <ul className="flex flex-col gap-2">
            {data.invites.map((invite) => (
              <InviteRow key={invite.playlistId} invite={invite} />
            ))}
          </ul>
        </Group>
      ) : null}
      {data && data.incoming.length > 0 ? (
        <Group title={t('social.incoming')}>
          <ul className="flex flex-col">
            {data.incoming.map((user) => (
              <UserRow key={user.username} user={user}>
                <Button onClick={() => void accept(user.username)}>
                  <Check className="size-4" />
                  {t('social.accept')}
                </Button>
                <button
                  type="button"
                  aria-label={t('social.decline')}
                  onClick={() => void remove(user.username)}
                  className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-text"
                >
                  <X className="size-4" />
                </button>
              </UserRow>
            ))}
          </ul>
        </Group>
      ) : null}
      {data && data.friends.length > 0 ? (
        <Group title={t('social.friends', { count: data.friends.length })}>
          <ul className="flex flex-col">
            {data.friends.map((user) => (
              <UserRow key={user.username} user={user} />
            ))}
          </ul>
        </Group>
      ) : null}
      {data && data.outgoing.length > 0 ? (
        <Group title={t('social.outgoing')}>
          <ul className="flex flex-col">
            {data.outgoing.map((user) => (
              <UserRow key={user.username} user={user}>
                <Button variant={ButtonVariant.Ghost} onClick={() => void remove(user.username)}>
                  {t('social.cancel')}
                </Button>
              </UserRow>
            ))}
          </ul>
        </Group>
      ) : null}
    </Page>
  );
}
