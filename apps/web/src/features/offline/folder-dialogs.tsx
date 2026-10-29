import { Check, Folder, FolderPlus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../ui/button.tsx';
import { Dialog } from '../../ui/dialog.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { useToast } from '../../ui/toast.tsx';
import { MAX_FOLDER_NAME } from './db.ts';
import { sortedFolders, useFolders } from './folders.ts';

interface FolderNameDialogProps {
  // Renames this folder; without it, a new folder is created.
  folderId?: string;
  trackIds?: string[];
  onClose: () => void;
  onSaved?: (id: string) => void;
}

/** Creates a folder (optionally with songs in it) or renames one. */
export function FolderNameDialog({ folderId, trackIds, onClose, onSaved }: FolderNameDialogProps) {
  const { t } = useTranslation();
  const current = useFolders((state) => (folderId ? state.folders.get(folderId) : undefined));
  const [name, setName] = useState(current?.name ?? '');
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const { create, rename } = useFolders.getState();
    const trimmed = name.trim();
    const id = folderId ?? (await create(trimmed, trackIds));

    if (folderId) {
      await rename(folderId, trimmed);
    }

    setIsBusy(false);

    if (id) {
      onSaved?.(id);
    }

    onClose();
  }

  return (
    <Dialog title={folderId ? t('folders.rename') : t('folders.new')} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <TextField
          label={t('folders.name')}
          required
          maxLength={MAX_FOLDER_NAME}
          autoFocus
          placeholder={t('folders.namePlaceholder')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" isBusy={isBusy} disabled={name.trim() === ''}>
          {folderId ? t('folders.save') : t('folders.create')}
        </Button>
      </form>
    </Dialog>
  );
}

/** Puts downloaded songs in folders; tapping a folder that has them all takes them out. */
export function AddToFolderDialog({
  trackIds,
  onClose,
}: {
  trackIds: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const folders = useFolders((state) => state.folders);
  const showToast = useToast((state) => state.show);
  const [isCreating, setIsCreating] = useState(false);

  if (isCreating) {
    return (
      <FolderNameDialog
        trackIds={trackIds}
        onClose={onClose}
        onSaved={(id) => {
          const name = useFolders.getState().folders.get(id)?.name ?? '';
          showToast(t('folders.added', { name }));
        }}
      />
    );
  }

  return (
    <Dialog title={t('folders.pick')} onClose={onClose}>
      <button
        type="button"
        onClick={() => setIsCreating(true)}
        className="flex items-center gap-3 rounded-xl p-2 text-left font-bold hover:bg-surface"
      >
        <span className="grid size-11 place-items-center rounded-lg bg-surface-2">
          <FolderPlus className="size-5" />
        </span>
        {t('folders.new')}
      </button>
      {folders.size === 0 ? <p className="text-sm text-muted">{t('folders.none')}</p> : null}
      <ul className="flex flex-col">
        {sortedFolders(folders).map((folder) => {
          const hasAll = trackIds.every((id) => folder.trackIds.includes(id));

          return (
            <li key={folder.id}>
              <button
                type="button"
                aria-pressed={hasAll}
                onClick={() => {
                  const { addTracks, removeTracks } = useFolders.getState();

                  if (hasAll) {
                    void removeTracks(folder.id, trackIds);
                    showToast(t('folders.removed', { name: folder.name }));
                  } else {
                    void addTracks(folder.id, trackIds);
                    showToast(t('folders.added', { name: folder.name }));
                  }
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                  <Folder className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{folder.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {t('music.songs', { count: folder.trackIds.length })}
                  </span>
                </span>
                {hasAll ? <Check className="size-5 text-accent" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
