import { CheckCircle2, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Track } from '@lyra/shared';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { usePlayerStore } from '../player/player-store.ts';
import { useDownloads } from './downloads.ts';

/** Downloads a whole album or playlist; shows progress while songs are in line. */
export function DownloadAllButton({ tracks }: { tracks: Track[] }) {
  const { t } = useTranslation();
  const records = useDownloads((state) => state.records);
  const progress = useDownloads((state) => state.progress);
  const download = useDownloads((state) => state.download);
  const remove = useDownloads((state) => state.remove);
  const quality = usePlayerStore((state) => state.settings.quality);
  const done = tracks.filter((track) => records.has(track.id)).length;
  const isBusy = tracks.some((track) => progress.has(track.id));
  const isComplete = done === tracks.length && tracks.length > 0;

  if (isComplete) {
    return (
      <Button
        variant={ButtonVariant.Secondary}
        aria-label={t('offline.removeAll')}
        title={t('offline.removeAll')}
        onClick={() => void remove(tracks.map((track) => track.id))}
      >
        <CheckCircle2 className="size-4 text-success" />
        <span className="hidden sm:inline">{t('offline.allDownloaded')}</span>
      </Button>
    );
  }

  return (
    <Button
      variant={ButtonVariant.Secondary}
      isBusy={isBusy}
      aria-label={
        done > 0
          ? t('offline.downloadRemaining', { count: tracks.length - done })
          : t('offline.downloadAll')
      }
      onClick={() => download(tracks, quality)}
    >
      {isBusy ? null : <Download className="size-4" />}
      {/* Phones get the icon alone, so Play, Shuffle and Download fit on one line. */}
      <span className={isBusy ? '' : 'hidden sm:inline'}>
        {isBusy
          ? t('offline.downloadingAll', { done, total: tracks.length })
          : done > 0
            ? t('offline.downloadRemaining', { count: tracks.length - done })
            : t('offline.downloadAll')}
      </span>
    </Button>
  );
}

/** Small marker next to downloaded songs, or the live percentage while downloading. */
export function DownloadBadge({ id }: { id: string }) {
  const { t } = useTranslation();
  const isDownloaded = useDownloads((state) => state.records.has(id));
  const fraction = useDownloads((state) => state.progress.get(id));

  if (fraction !== undefined) {
    return (
      <span className="text-[11px] text-accent tabular-nums">
        {t('offline.downloading', { percent: Math.round(fraction * 100) })}
      </span>
    );
  }

  return isDownloaded ? (
    <CheckCircle2
      aria-label={t('offline.downloaded')}
      className="size-3.5 shrink-0 fill-success text-bg"
    />
  ) : null;
}
