import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatBytes } from '../../lib/format.ts';
import { CollectionHeader } from '../music/collection-header.tsx';
import { TrackList } from '../music/track-list.tsx';
import { storageEstimate, useDownloads } from './downloads.ts';

export function DownloadsPage() {
  const { t } = useTranslation();
  const records = useDownloads((state) => state.records);
  const [used, setUsed] = useState<number | null>(null);
  const tracks = useMemo(
    () =>
      [...records.values()]
        .sort((a, b) => b.downloadedAt - a.downloadedAt)
        .map((record) => record.track),
    [records],
  );

  useEffect(() => {
    void storageEstimate().then((estimate) => setUsed(estimate.used));
  }, [records]);

  return (
    <div className="p-4 pt-0 sm:p-7 sm:pt-0">
      <CollectionHeader
        kind={t('music.playlist')}
        title={t('offline.title')}
        subtitle={[
          t('music.songs', { count: tracks.length }),
          used === null ? '' : t('offline.storage', { used: formatBytes(used) }),
        ]
          .filter(Boolean)
          .join(' · ')}
        thumbnail={tracks[0]?.thumbnail ?? null}
        tracks={tracks}
      />
      {tracks.length === 0 ? (
        <p className="max-w-md text-sm text-muted">{t('offline.empty')}</p>
      ) : (
        <TrackList tracks={tracks} />
      )}
    </div>
  );
}
