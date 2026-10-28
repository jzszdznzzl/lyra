import { Laptop, MonitorSpeaker, Smartphone, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DeviceKind } from '@lyra/shared';

import { formatRelative } from '../../lib/format.ts';
import { Dialog } from '../../ui/dialog.tsx';
import { usePlayerStore } from '../player/player-store.ts';
import { activeDevice, useConnectStore } from './connect-store.ts';

export function DevicePicker({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const devices = useConnectStore((state) => state.devices);
  const selfId = useConnectStore((state) => state.selfId);
  const active = useConnectStore(activeDevice);
  const transfer = useConnectStore((state) => state.transfer);
  const volume = usePlayerStore((state) => state.remote?.volume ?? state.settings.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const others = devices.filter((device) => device.id !== active?.id);

  return (
    <Dialog title={t('connect.title')} onClose={onClose}>
      <p className="-mt-2 text-sm text-muted">{t('connect.subtitle')}</p>
      {active ? (
        <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/25 to-accent-2/15 p-4">
          <p className="text-[11px] font-bold tracking-widest text-accent-2 uppercase">
            {t('connect.current')}
          </p>
          <p className="mt-1 text-[17px] font-bold">
            {active.name}
            {active.id === selfId ? (
              <span className="ml-2 text-xs font-semibold text-muted">
                · {t('connect.thisDevice')}
              </span>
            ) : null}
          </p>
          <label className="mt-3 flex items-center gap-3 text-sm text-muted">
            <Volume2 className="size-4" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              aria-label={t('player.volume')}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="w-10 text-right tabular-nums">{Math.round(volume * 100)}%</span>
          </label>
        </div>
      ) : null}
      <ul className="flex flex-col divide-y divide-line">
        {others.map((device) => {
          const Icon = device.kind === DeviceKind.Mobile ? Smartphone : Laptop;
          const isSelf = device.id === selfId;

          return (
            <li key={device.id} className="flex items-center gap-3.5 py-3">
              <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
                <Icon className="size-5 text-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{device.name}</p>
                <p className="text-xs text-muted">
                  {isSelf
                    ? t('connect.thisDevice')
                    : `${t('connect.idle')} · ${formatRelative(device.lastSeenAt, i18n.language)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  transfer(device.id);
                  onClose();
                }}
                className="rounded-full bg-text px-3.5 py-2 text-[13px] font-extrabold text-bg"
              >
                {isSelf ? t('connect.listenHere') : t('connect.playOn')}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

/** Opens the picker; shows where music plays when it is not this device. */
export function DeviceButton({ isLabelled = false }: { isLabelled?: boolean }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const active = useConnectStore(activeDevice);
  const selfId = useConnectStore((state) => state.selfId);
  const isElsewhere = active !== null && active.id !== selfId;

  return (
    <>
      <button
        type="button"
        aria-label={t('connect.devices')}
        onClick={() => setIsOpen(true)}
        className={`flex min-w-0 items-center gap-1.5 rounded-lg p-1.5 text-xs font-bold hover:bg-surface ${isElsewhere ? 'text-emerald-400' : 'text-muted hover:text-text'}`}
      >
        <MonitorSpeaker className="size-[18px] shrink-0" />
        {isLabelled && isElsewhere ? (
          <span className="max-w-48 truncate">{t('connect.playingOn', { name: active.name })}</span>
        ) : null}
      </button>
      {isOpen ? <DevicePicker onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
