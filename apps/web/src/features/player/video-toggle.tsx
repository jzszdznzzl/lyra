import { Clapperboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { MediaKind } from '@lyra/shared';
import type { Track } from '@lyra/shared';

import { useToast } from '../../ui/toast.tsx';
import { usePlayerStore } from './player-store.ts';

/** Song ⇄ Video switch, like YT Music's. */
export function VideoToggle({ track }: { track: Track }) {
  const { t } = useTranslation();
  const isVideoMode = usePlayerStore((state) => state.isVideoMode);
  const isFinding = usePlayerStore((state) => state.isFindingVideo);
  const showToast = useToast((state) => state.show);
  const isShowingVideo = isVideoMode && track.kind === MediaKind.Video;

  return (
    <div className="inline-flex rounded-full bg-black/40 p-0.5 text-[11px] font-extrabold tracking-wider text-white uppercase backdrop-blur">
      <button
        type="button"
        aria-pressed={!isShowingVideo}
        onClick={() => usePlayerStore.getState().hideVideo()}
        className="rounded-full px-3 py-1 aria-pressed:bg-white aria-pressed:text-black"
      >
        {t('video.song')}
      </button>
      <button
        type="button"
        aria-pressed={isShowingVideo}
        disabled={isFinding}
        onClick={() => {
          void usePlayerStore
            .getState()
            .showVideo()
            .then((isFound) => {
              if (!isFound) {
                showToast(t('video.notFound'));
              }
            });
        }}
        className="flex items-center gap-1 rounded-full px-3 py-1 aria-pressed:bg-white aria-pressed:text-black disabled:opacity-60"
      >
        {isFinding ? (
          <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Clapperboard className="size-3" />
        )}
        {t('video.video')}
      </button>
    </div>
  );
}
