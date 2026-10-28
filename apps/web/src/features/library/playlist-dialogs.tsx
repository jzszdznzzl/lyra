import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { PlaylistPrivacy } from '@lyra/shared';
import type { Track } from '@lyra/shared';

import { Button } from '../../ui/button.tsx';
import { Cover } from '../../ui/cover.tsx';
import { Dialog } from '../../ui/dialog.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { useToast } from '../../ui/toast.tsx';
import { useErrorText } from '../auth/use-error-text.ts';
import { libraryPlaylistsQuery } from '../music/api.ts';
import { addToPlaylist, createPlaylist, renamePlaylist } from './api.ts';
import type { ApiError } from '../../lib/api.ts';

const PRIVACY_LABELS = {
  [PlaylistPrivacy.Private]: 'library.private',
  [PlaylistPrivacy.Unlisted]: 'library.unlisted',
  [PlaylistPrivacy.Public]: 'library.public',
} as const satisfies Record<PlaylistPrivacy, string>;

function useRefreshLibrary() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: libraryPlaylistsQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: ['music', 'playlist'] }),
    ]);
}

interface CreatePlaylistDialogProps {
  tracks?: Track[];
  onClose: () => void;
  onCreated?: (id: string, title: string) => void;
}

export function CreatePlaylistDialog({
  tracks = [],
  onClose,
  onCreated,
}: CreatePlaylistDialogProps) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const refresh = useRefreshLibrary();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<PlaylistPrivacy>(PlaylistPrivacy.Private);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await createPlaylist({
      title,
      description,
      privacy,
      trackIds: tracks.map((track) => track.id),
    });
    setIsBusy(false);
    setError(result.error);

    if (result.data) {
      await refresh();
      onCreated?.(result.data.id, title);
      onClose();
    }
  }

  return (
    <Dialog title={t('library.createTitle')} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
        <TextField
          label={t('library.name')}
          required
          maxLength={150}
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          label={t('library.description')}
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wider text-muted uppercase">
            {t('library.privacy')}
          </span>
          <div className="flex gap-2">
            {Object.values(PlaylistPrivacy).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={privacy === option}
                onClick={() => setPrivacy(option)}
                className="rounded-full border border-line px-4 py-2 text-sm font-bold text-muted aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
              >
                {t(PRIVACY_LABELS[option])}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" isBusy={isBusy} disabled={title.trim() === ''}>
          <Plus className="size-4" />
          {t('library.create')}
        </Button>
      </form>
    </Dialog>
  );
}

export function AddToPlaylistDialog({ tracks, onClose }: { tracks: Track[]; onClose: () => void }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const refresh = useRefreshLibrary();
  const showToast = useToast((state) => state.show);
  const playlists = useQuery(libraryPlaylistsQuery);
  const [error, setError] = useState<ApiError | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function add(id: string, title: string) {
    const result = await addToPlaylist(
      id,
      tracks.map((track) => track.id),
    );
    setError(result.error);

    if (!result.error) {
      await refresh();
      showToast(t('library.added', { title }));
      onClose();
    }
  }

  if (isCreating) {
    return (
      <CreatePlaylistDialog
        tracks={tracks}
        onClose={onClose}
        onCreated={(_, title) => showToast(t('library.added', { title }))}
      />
    );
  }

  return (
    <Dialog title={t('library.pickPlaylist')} onClose={onClose}>
      {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
      <button
        type="button"
        onClick={() => setIsCreating(true)}
        className="flex items-center gap-3 rounded-xl p-2 text-left font-bold hover:bg-surface"
      >
        <span className="grid size-11 place-items-center rounded-lg bg-surface-2">
          <ListPlus className="size-5" />
        </span>
        {t('library.newPlaylist')}
      </button>
      {playlists.data?.playlists.length === 0 ? (
        <p className="text-sm text-muted">{t('library.noPlaylists')}</p>
      ) : null}
      <ul className="flex flex-col">
        {playlists.data?.playlists.map((playlist) => (
          <li key={playlist.id}>
            <button
              type="button"
              onClick={() => void add(playlist.id, playlist.title)}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface"
            >
              <Cover src={playlist.thumbnail} alt="" className="size-11 shrink-0 rounded-lg" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{playlist.title}</span>
                <span className="block truncate text-xs text-muted">{playlist.subtitle}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function RenamePlaylistDialog({
  id,
  current,
  onClose,
}: {
  id: string;
  current: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const refresh = useRefreshLibrary();
  const [title, setTitle] = useState(current);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await renamePlaylist(id, title);
    setIsBusy(false);
    setError(result.error);

    if (!result.error) {
      await refresh();
      onClose();
    }
  }

  return (
    <Dialog title={t('library.renameTitle')} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
        <TextField
          label={t('library.name')}
          required
          maxLength={150}
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button type="submit" isBusy={isBusy} disabled={title.trim() === '' || title === current}>
          {t('library.save')}
        </Button>
      </form>
    </Dialog>
  );
}
