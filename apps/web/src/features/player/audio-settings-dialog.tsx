import { useTranslation } from 'react-i18next';

import { AudioQuality, VIDEO_HEIGHTS } from '@lyra/shared';

import {
  EQ_FREQUENCIES,
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_PRESETS,
  EqPreset,
} from '../../audio/equalizer.ts';
import { Dialog } from '../../ui/dialog.tsx';
import { Toggle } from '../../ui/toggle.tsx';
import { usePlayerStore } from './player-store.ts';
import { MAX_CROSSFADE_SECONDS, MAX_FADE_MS, isOnMeteredNetwork } from './settings.ts';
import { VolumeSettings } from './volume-settings.tsx';

const FADE_STEP_MS = 100;

function bandLabel(frequency: number) {
  return frequency >= 1000 ? `${frequency / 1000}k` : String(frequency);
}

export function AudioSettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const settings = usePlayerStore((state) => state.settings);
  const updateSettings = usePlayerStore((state) => state.updateSettings);

  function setBand(band: number, gain: number) {
    const eqGains = settings.eqGains.map((value, index) => (index === band ? gain : value));
    updateSettings({ eqGains, eqPreset: EqPreset.Custom, isEqEnabled: true });
  }

  return (
    <Dialog title={t('player.settings.title')} onClose={onClose}>
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-bold tracking-wider text-muted uppercase">
          {t('player.settings.quality')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(AudioQuality).map((quality) => (
            <button
              key={quality}
              type="button"
              aria-pressed={settings.quality === quality}
              onClick={() => updateSettings({ quality })}
              className="rounded-xl border border-line p-3 text-left transition aria-pressed:border-accent aria-pressed:bg-accent/10"
            >
              <span className="block text-sm font-bold">{t(`player.settings.${quality}`)}</span>
              <span className="block text-xs text-muted">
                {t(`player.settings.${quality}Hint`)}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{t('player.settings.qualityHint')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="font-bold">{t('player.settings.crossfade')}</span>
          <span className="text-muted">
            {settings.crossfadeSeconds === 0
              ? t('player.settings.crossfadeOff')
              : t('player.settings.seconds', { count: settings.crossfadeSeconds })}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_CROSSFADE_SECONDS}
          step={1}
          value={settings.crossfadeSeconds}
          aria-label={t('player.settings.crossfade')}
          onChange={(event) => updateSettings({ crossfadeSeconds: Number(event.target.value) })}
          className="accent-[var(--accent)]"
        />
        <div className="flex justify-between text-sm">
          <span className="font-bold">{t('player.settings.fade')}</span>
          <span className="text-muted">{t('player.settings.ms', { count: settings.fadeMs })}</span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_FADE_MS}
          step={FADE_STEP_MS}
          value={settings.fadeMs}
          aria-label={t('player.settings.fade')}
          onChange={(event) => updateSettings({ fadeMs: Number(event.target.value) })}
          className="accent-[var(--accent)]"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">{t('video.quality')}</span>
          <div className="flex gap-1.5">
            {VIDEO_HEIGHTS.map((height) => (
              <button
                key={height}
                type="button"
                aria-pressed={settings.videoHeight === height}
                onClick={() => updateSettings({ videoHeight: height })}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
              >
                {height}p
              </button>
            ))}
          </div>
        </div>
        <section className="flex flex-col gap-2 rounded-2xl border border-line p-3">
          <Toggle
            label={t('player.settings.dataSaver')}
            isOn={settings.isDataSaverEnabled}
            onChange={(isDataSaverEnabled) => updateSettings({ isDataSaverEnabled })}
          />
          <p className="text-xs text-muted">
            {t('player.settings.dataSaverHint')}
            {isOnMeteredNetwork() ? ` ${t('player.settings.onMobileData')}` : ''}
          </p>
          {settings.isDataSaverEnabled ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(AudioQuality).map((quality) => (
                  <button
                    key={quality}
                    type="button"
                    aria-pressed={settings.cellularQuality === quality}
                    onClick={() => updateSettings({ cellularQuality: quality })}
                    className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
                  >
                    {t(`player.settings.${quality}`)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {VIDEO_HEIGHTS.map((height) => (
                  <button
                    key={height}
                    type="button"
                    aria-pressed={settings.cellularVideoHeight === height}
                    onClick={() => updateSettings({ cellularVideoHeight: height })}
                    className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
                  >
                    {t('player.settings.videoOnData', { height })}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </section>
        <Toggle
          label={t('player.settings.autoplay')}
          isOn={settings.isAutoplayEnabled}
          onChange={(isAutoplayEnabled) => updateSettings({ isAutoplayEnabled })}
        />
        <Toggle
          label={t('player.settings.lyricsSync')}
          isOn={settings.isLyricsSyncEnabled}
          onChange={(isLyricsSyncEnabled) => updateSettings({ isLyricsSyncEnabled })}
        />
      </section>

      <VolumeSettings />

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-bold tracking-wider text-muted uppercase">
          {t('player.settings.equalizer')}
        </h3>
        <Toggle
          label={t('player.settings.eqEnabled')}
          isOn={settings.isEqEnabled}
          onChange={(isEqEnabled) => updateSettings({ isEqEnabled })}
        />
        <div className="flex flex-wrap gap-1.5">
          {Object.values(EqPreset).map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={settings.eqPreset === preset}
              disabled={preset === EqPreset.Custom}
              onClick={() => {
                if (preset !== EqPreset.Custom) {
                  updateSettings({
                    eqPreset: preset,
                    eqGains: [...EQ_PRESETS[preset]],
                    isEqEnabled: true,
                  });
                }
              }}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted disabled:cursor-default aria-pressed:border-transparent aria-pressed:bg-text aria-pressed:text-bg"
            >
              {t(`player.presets.${preset}`)}
            </button>
          ))}
        </div>
        <div
          className={`flex h-44 justify-between gap-1 ${settings.isEqEnabled ? '' : 'opacity-40'}`}
        >
          {EQ_FREQUENCIES.map((frequency, band) => (
            <label
              key={frequency}
              className="flex flex-1 flex-col items-center gap-1 text-[10px] text-muted"
            >
              <span className="tabular-nums">{Math.round(settings.eqGains[band] ?? 0)}</span>
              <input
                type="range"
                min={EQ_MIN_DB}
                max={EQ_MAX_DB}
                step={1}
                value={settings.eqGains[band] ?? 0}
                aria-label={`${bandLabel(frequency)} Hz`}
                onChange={(event) => setBand(band, Number(event.target.value))}
                className="min-h-0 w-full flex-1 cursor-pointer accent-[var(--accent)] [writing-mode:vertical-lr] [direction:rtl]"
              />
              {bandLabel(frequency)}
            </label>
          ))}
        </div>
      </section>
    </Dialog>
  );
}
