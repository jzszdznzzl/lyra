import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Toggle } from '../../ui/toggle.tsx';
import { usePlayerStore } from './player-store.ts';
import { maxVolume } from './settings.ts';

export function VolumeSettings() {
  const { t } = useTranslation();
  const settings = usePlayerStore((state) => state.settings);
  const updateSettings = usePlayerStore((state) => state.updateSettings);
  const setVolume = usePlayerStore((state) => state.setVolume);
  // The boost is only turned on after the warning is read and accepted.
  const [isConfirmingBoost, setIsConfirmingBoost] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-bold tracking-wider text-muted uppercase">
        {t('player.settings.volume')}
      </h3>
      {/* Phones have no volume bar, so the boost needs a slider here too. */}
      <label className="flex items-center gap-3 text-sm">
        <input
          type="range"
          min={0}
          max={maxVolume(settings)}
          step={0.01}
          value={settings.volume}
          aria-label={t('player.volume')}
          aria-valuetext={`${Math.round(settings.volume * 100)}%`}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="flex-1 accent-[var(--accent)]"
        />
        <span
          className={`w-11 text-right tabular-nums ${settings.volume > 1 ? 'font-bold text-accent' : 'text-muted'}`}
        >
          {Math.round(settings.volume * 100)}%
        </span>
      </label>
      <Toggle
        label={t('player.settings.normalization')}
        hint={t('player.settings.normalizationHint')}
        isOn={settings.isNormalizationEnabled}
        onChange={(isNormalizationEnabled) => updateSettings({ isNormalizationEnabled })}
      />
      <Toggle
        label={t('player.settings.limiter')}
        hint={t('player.settings.limiterHint')}
        isOn={settings.isLimiterEnabled}
        onChange={(isLimiterEnabled) => updateSettings({ isLimiterEnabled })}
      />
      <Toggle
        label={t('player.settings.boost')}
        hint={t('player.settings.boostHint')}
        isOn={settings.isVolumeBoostEnabled || isConfirmingBoost}
        onChange={(isOn) => {
          if (isOn) {
            setIsConfirmingBoost(true);
          } else {
            setIsConfirmingBoost(false);
            updateSettings({ isVolumeBoostEnabled: false });
          }
        }}
      />
      {isConfirmingBoost ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-3"
        >
          <p className="flex gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>
              {t('player.settings.boostWarning')}
              {settings.isLimiterEnabled ? '' : ` ${t('player.settings.boostWarningNoLimiter')}`}
            </span>
          </p>
          <div className="flex justify-end gap-2">
            <Button variant={ButtonVariant.Ghost} onClick={() => setIsConfirmingBoost(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={ButtonVariant.Danger}
              onClick={() => {
                setIsConfirmingBoost(false);
                updateSettings({ isVolumeBoostEnabled: true });
              }}
            >
              {t('player.settings.boostConfirm')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
