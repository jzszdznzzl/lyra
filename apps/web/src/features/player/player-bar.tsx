import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Cover } from '../../ui/cover.tsx';
import { LikeButton } from '../library/like-button.tsx';
import { ArtistLinks } from '../music/artist-links.tsx';
import { AudioSettingsDialog } from './audio-settings-dialog.tsx';
import { currentTrack, usePlayerStore } from './player-store.ts';
import { ProgressBar } from './progress-bar.tsx';
import { TransportControls } from './transport-controls.tsx';
import { VolumeControl } from './volume-control.tsx';

/** Bottom bar on tablets and desktops. */
export function PlayerBar() {
  const { t } = useTranslation();
  const track = usePlayerStore(currentTrack);
  const settings = usePlayerStore((state) => state.settings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <footer className="col-span-full hidden h-24 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-line bg-panel px-5 backdrop-blur-2xl md:grid">
      <div className="flex min-w-0 items-center gap-3.5">
        {track ? (
          <>
            <Cover src={track.thumbnail} alt="" className="size-14 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-bold">{track.title}</p>
              <p className="truncate text-[12.5px] text-muted">
                <ArtistLinks artists={track.artists} />
              </p>
            </div>
            <LikeButton track={track} />
          </>
        ) : (
          <p className="text-sm text-muted">{t('player.nothingPlaying')}</p>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <TransportControls />
        <ProgressBar />
      </div>
      <div className="flex items-center justify-end gap-3 text-xs font-semibold text-muted">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 whitespace-nowrap hover:text-text lg:flex"
        >
          <span className="text-accent">{t(`player.settings.${settings.quality}`)}</span>
          {settings.crossfadeSeconds > 0 ? (
            <span>· {t('player.settings.seconds', { count: settings.crossfadeSeconds })}</span>
          ) : null}
          {settings.isEqEnabled ? <span>· EQ</span> : null}
        </button>
        <button
          type="button"
          aria-label={t('player.settings.title')}
          onClick={() => setIsSettingsOpen(true)}
          className="rounded-lg p-1.5 hover:bg-surface hover:text-text"
        >
          <SlidersHorizontal className="size-[18px]" />
        </button>
        <VolumeControl />
      </div>
      {isSettingsOpen ? <AudioSettingsDialog onClose={() => setIsSettingsOpen(false)} /> : null}
    </footer>
  );
}
