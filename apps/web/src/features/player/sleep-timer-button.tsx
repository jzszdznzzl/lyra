import { Moon, MoonStar, TimerOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Menu } from '../../ui/menu.tsx';
import type { MenuItem } from '../../ui/menu.tsx';
import { usePlayerStore } from './player-store.ts';
import { SLEEP_MINUTES, minutesLeft, useSleepTimer } from './sleep-timer.ts';

// The label counts down in minutes, so it only needs to refresh a few times a minute.
const REFRESH_MS = 15_000;

/** Moon button that stops the music after a while, or at the end of the song. */
export function SleepTimerButton({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const endsAt = useSleepTimer((state) => state.endsAt);
  const stopsAfterTrack = usePlayerStore((state) => state.stopsAfterTrack);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const isActive = endsAt !== null || stopsAfterTrack;

  useEffect(() => {
    if (endsAt === null) {
      return;
    }

    // Right away too: the clock may be stale from before the timer was set.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), REFRESH_MS);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [endsAt]);

  const { start, startUntilTrackEnds, cancel } = useSleepTimer.getState();
  const items: MenuItem[] = [
    ...SLEEP_MINUTES.map((minutes) => ({
      label: t('player.sleep.minutes', { count: minutes }),
      icon: <Moon className="size-4" />,
      onSelect: () => start(minutes),
    })),
    {
      label: t('player.sleep.endOfTrack'),
      icon: <MoonStar className="size-4" />,
      onSelect: startUntilTrackEnds,
    },
  ];

  if (isActive) {
    items.push({
      label: t('player.sleep.off'),
      icon: <TimerOff className="size-4" />,
      isDanger: true,
      onSelect: cancel,
    });
  }

  const status =
    endsAt !== null
      ? t('player.sleep.left', { count: minutesLeft(endsAt, now) })
      : stopsAfterTrack
        ? t('player.sleep.afterTrack')
        : null;

  return (
    <>
      <button
        type="button"
        aria-label={status ? `${t('player.sleep.title')}: ${status}` : t('player.sleep.title')}
        aria-haspopup="menu"
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
        className={`flex items-center gap-1 rounded-lg p-1.5 hover:bg-surface hover:text-text ${isActive ? 'text-accent' : ''} ${className}`}
      >
        <Moon className={`size-[18px] ${isActive ? 'fill-current' : ''}`} />
        {status ? (
          <span className="text-xs font-bold whitespace-nowrap tabular-nums">{status}</span>
        ) : null}
      </button>
      {anchor ? <Menu anchor={anchor} items={items} onClose={() => setAnchor(null)} /> : null}
    </>
  );
}
