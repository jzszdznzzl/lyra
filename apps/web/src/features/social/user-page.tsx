import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Check, ListMusic, Pencil, Radio, UserMinus, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { FriendStatus } from '@lyra/shared';
import type { NowPlaying, UserPage as UserPageData } from '@lyra/shared';

import { formatRelative } from '../../lib/format.ts';
import { useDocumentTitle } from '../../lib/use-document-title.ts';
import { Avatar } from '../../ui/avatar.tsx';
import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Cover } from '../../ui/cover.tsx';
import { Dialog } from '../../ui/dialog.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { Page } from '../../ui/page.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { meQuery } from '../auth/api.ts';
import { useErrorText } from '../auth/use-error-text.ts';
import { libraryPlaylistsQuery } from '../music/api.ts';
import { MediaCard } from '../music/media-card.tsx';
import { ErrorState, LoadingState } from '../music/query-state.tsx';
import { TrackList } from '../music/track-list.tsx';
import { usePlayerStore } from '../player/player-store.ts';
import {
  addFriend,
  createSharedPlaylist,
  removeFriend,
  userMusicQuery,
  userPageQuery,
} from './api.ts';
import type { ApiError } from '../../lib/api.ts';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[19px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function NowPlayingCard({ nowPlaying }: { nowPlaying: NowPlaying }) {
  const { t, i18n } = useTranslation();
  const { track } = nowPlaying;

  return (
    <Link
      to="/track/$id"
      params={{ id: track.id }}
      className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition hover:bg-surface-2"
    >
      <Cover src={track.coverUrl} alt="" className="size-16 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-accent uppercase">
          {nowPlaying.isPlaying ? <Radio className="size-3.5 animate-pulse" /> : null}
          {nowPlaying.isPlaying
            ? t('social.listeningNow')
            : t('social.lastHeard', { when: formatRelative(nowPlaying.updatedAt, i18n.language) })}
        </span>
        <span className="mt-0.5 block truncate font-semibold">{track.title}</span>
        <span className="block truncate text-sm text-muted">
          {track.artists.map((artist) => artist.name).join(', ')}
        </span>
      </span>
    </Link>
  );
}

function CreateSharedDialog({ page, onClose }: { page: UserPageData; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const { data: me } = useSuspenseQuery(meQuery);
  const [title, setTitle] = useState(() => `${me?.name ?? ''} & ${page.user.name}`.trim());
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await createSharedPlaylist({
      title: title.trim(),
      username: page.user.username,
    });
    setIsBusy(false);
    setError(result.error);

    if (result.data) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: libraryPlaylistsQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: ['social'] }),
      ]);
      onClose();
      await navigate({ to: '/playlist/$id', params: { id: result.data.id } });
    }
  }

  return (
    <Dialog title={t('social.createTitle')} onClose={onClose}>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('social.createHint', { name: page.user.name })}</p>
        <TextField
          label={t('library.name')}
          value={title}
          maxLength={150}
          onChange={(event) => setTitle(event.target.value)}
          error={errorText(error)}
        />
        <Button type="submit" isBusy={isBusy} disabled={title.trim() === ''}>
          <ListMusic className="size-4" />
          {t('social.create')}
        </Button>
      </form>
    </Dialog>
  );
}

function FriendActions({ page }: { page: UserPageData }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const [isCreating, setIsCreating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const username = page.user.username;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['social'] });
  }

  async function add() {
    await addFriend(username);
    await refresh();
  }

  async function remove() {
    setIsConfirming(false);
    await removeFriend(username);
    await refresh();
  }

  switch (page.status) {
    case FriendStatus.Self: {
      return (
        <Link
          to="/profile"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-bold transition hover:bg-surface"
        >
          <Pencil className="size-4" />
          {t('social.editProfile')}
        </Link>
      );
    }
    case FriendStatus.None: {
      return (
        <Button onClick={() => void add()}>
          <UserPlus className="size-4" />
          {t('social.add')}
        </Button>
      );
    }
    case FriendStatus.Outgoing: {
      return (
        <Button variant={ButtonVariant.Secondary} onClick={() => void remove()}>
          <X className="size-4" />
          {t('social.cancelRequest')}
        </Button>
      );
    }
    case FriendStatus.Incoming: {
      return (
        <>
          <Button onClick={() => void add()}>
            <Check className="size-4" />
            {t('social.accept')}
          </Button>
          <Button variant={ButtonVariant.Ghost} onClick={() => void remove()}>
            {t('social.decline')}
          </Button>
        </>
      );
    }
    case FriendStatus.Friends: {
      const canCreate = (me?.isGoogleLinked ?? false) && page.isGoogleLinked;

      return (
        <>
          <Button disabled={!canCreate} onClick={() => setIsCreating(true)}>
            <ListMusic className="size-4" />
            {t('social.createTogether')}
          </Button>
          <Button variant={ButtonVariant.Ghost} onClick={() => setIsConfirming(true)}>
            <UserMinus className="size-4" />
            {t('social.unfriend')}
          </Button>
          {page.isGoogleLinked && !(me?.isGoogleLinked ?? false) ? (
            <p className="w-full text-center text-xs text-muted sm:text-left">
              {t('social.createNeedsGoogle')}
            </p>
          ) : null}
          {isCreating ? (
            <CreateSharedDialog page={page} onClose={() => setIsCreating(false)} />
          ) : null}
          {isConfirming ? (
            <Dialog title={t('social.unfriendTitle')} onClose={() => setIsConfirming(false)}>
              <p className="text-sm text-muted">
                {t('social.unfriendText', { name: page.user.name })}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant={ButtonVariant.Ghost} onClick={() => setIsConfirming(false)}>
                  {t('social.cancel')}
                </Button>
                <Button onClick={() => void remove()}>{t('social.unfriend')}</Button>
              </div>
            </Dialog>
          ) : null}
        </>
      );
    }
    default: {
      return null;
    }
  }
}

function FriendMusic({ page }: { page: UserPageData }) {
  const { t } = useTranslation();
  const music = useQuery(userMusicQuery(page.user.username));
  const playRadio = usePlayerStore((state) => state.playRadio);

  if (!page.isGoogleLinked) {
    return null;
  }

  if (music.isPending) {
    return <LoadingState />;
  }

  if (music.isError) {
    return <ErrorState error={music.error} onRetry={() => void music.refetch()} />;
  }

  return (
    <>
      <Section title={t('social.recent')}>
        {music.data.recent === null ? (
          <p className="text-sm text-muted">
            {t(page.status === FriendStatus.Self ? 'social.recentOffSelf' : 'social.recentOff', {
              name: page.user.name,
            })}
          </p>
        ) : music.data.recent.length === 0 ? (
          <p className="text-sm text-muted">{t('social.recentEmpty')}</p>
        ) : (
          <TrackList tracks={music.data.recent} />
        )}
      </Section>
      {music.data.publicPlaylists.length > 0 ? (
        <Section title={t('social.publicPlaylists')}>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {music.data.publicPlaylists.map((playlist) => (
              <MediaCard key={playlist.id} item={playlist} onPlay={(track) => playRadio(track)} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}

export function UserPage() {
  const { t } = useTranslation();
  const { username } = useParams({ from: '/app/user/$username' });
  const page = useQuery(userPageQuery(username));
  useDocumentTitle(page.data?.user.name ?? `@${username}`);

  if (page.isPending) {
    return (
      <Page>
        <LoadingState />
      </Page>
    );
  }

  if (page.isError) {
    return (
      <Page>
        <ErrorState error={page.error} onRetry={() => void page.refetch()} />
      </Page>
    );
  }

  const data = page.data;
  const canSee = data.status === FriendStatus.Friends || data.status === FriendStatus.Self;

  return (
    <Page>
      <header className="mt-6 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
        <Avatar name={data.user.name} url={data.user.avatarUrl} size={112} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wider text-muted uppercase">
            {t('social.profile')}
          </p>
          <h1 className="truncate text-3xl font-extrabold tracking-tight sm:text-5xl">
            {data.user.name}
          </h1>
          <p className="text-sm text-muted">@{data.user.username}</p>
        </div>
      </header>
      <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
        <FriendActions page={data} />
      </div>
      {data.status === FriendStatus.Friends && !data.isGoogleLinked ? (
        <div className="mt-5">
          <Notice tone={NoticeTone.Info}>
            {t('social.friendNotLinked', { name: data.user.name })}
          </Notice>
        </div>
      ) : null}
      {canSee ? (
        <>
          {data.nowPlaying ? (
            <Section title={t('social.nowPlaying')}>
              <NowPlayingCard nowPlaying={data.nowPlaying} />
            </Section>
          ) : null}
          {data.sharedPlaylists.length > 0 ? (
            <Section title={t('social.shared')}>
              <ul className="flex flex-col gap-2">
                {data.sharedPlaylists.map((playlist) => (
                  <li key={playlist.id}>
                    <Link
                      to="/playlist/$id"
                      params={{ id: playlist.id }}
                      className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-surface"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2">
                        <ListMusic className="size-5 text-white" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{playlist.title}</span>
                        <span className="block truncate text-sm text-muted">
                          {playlist.members.map((member) => member.name).join(', ')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <FriendMusic page={data} />
        </>
      ) : (
        <p className="mt-8 text-sm text-muted">{t('social.addToSee', { name: data.user.name })}</p>
      )}
    </Page>
  );
}
