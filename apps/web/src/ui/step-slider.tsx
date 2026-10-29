import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface StepSliderProps {
  value: number;
  min: number;
  max: number;
  // Precision of the slider itself.
  step: number;
  // How far one press of − or + moves; defaults to `step`.
  buttonStep?: number;
  onChange: (value: number) => void;
  label: string;
  valueText?: string;
  // Vertical puts + on top and − at the bottom, as in the equalizer.
  isVertical?: boolean;
  className?: string;
}

// Holding a button keeps stepping, after a pause long enough to tell it apart from a tap.
const HOLD_DELAY_MS = 400;
const REPEAT_MS = 90;
// Values like 0.15 + 0.05 come out a hair off; this absorbs that before snapping.
const EPSILON = 1e-6;

/** The next value one press away, snapped to the button's grid and kept within range. */
export function stepValue(
  value: number,
  direction: 1 | -1,
  size: number,
  min: number,
  max: number,
) {
  const steps =
    direction === 1
      ? Math.floor(value / size + EPSILON) + 1
      : Math.ceil(value / size - EPSILON) - 1;

  return Math.min(max, Math.max(min, Number((steps * size).toFixed(6))));
}

/**
 * A range slider with − and + buttons, for fine steps on touch screens where dragging is fiddly.
 * Buttons step once per tap and repeat while held.
 */
export function StepSlider({
  value,
  min,
  max,
  step,
  buttonStep = step,
  onChange,
  label,
  valueText,
  isVertical = false,
  className = '',
}: StepSliderProps) {
  const { t } = useTranslation();
  const latest = useRef({ value, onChange });
  const timers = useRef<{ hold: number | null; repeat: number | null }>({
    hold: null,
    repeat: null,
  });

  useEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);

  function stopHold() {
    if (timers.current.hold !== null) {
      window.clearTimeout(timers.current.hold);
    }

    if (timers.current.repeat !== null) {
      window.clearInterval(timers.current.repeat);
    }

    timers.current = { hold: null, repeat: null };
  }

  function press(direction: 1 | -1) {
    const next = stepValue(latest.current.value, direction, buttonStep, min, max);

    if (next !== latest.current.value) {
      // Updated here too, so a fast repeat does not step from a value React has not shown yet.
      latest.current = { ...latest.current, value: next };
      latest.current.onChange(next);
    }
  }

  function startHold(event: PointerEvent<HTMLButtonElement>, direction: 1 | -1) {
    if (event.button !== 0) {
      return;
    }

    stopHold();
    press(direction);
    // A disabled button (the end of the range) never gets the pointerup, so listen on window.
    window.addEventListener('pointerup', stopHold, { once: true });
    window.addEventListener('pointercancel', stopHold, { once: true });
    timers.current.hold = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => press(direction), REPEAT_MS);
    }, HOLD_DELAY_MS);
  }

  useEffect(() => () => stopHold(), []);

  const button = (direction: 1 | -1) => {
    const Icon = direction === 1 ? Plus : Minus;
    const isAtEnd = direction === 1 ? value >= max : value <= min;

    return (
      <button
        type="button"
        aria-label={t(direction === 1 ? 'common.increase' : 'common.decrease', { label })}
        disabled={isAtEnd}
        onPointerDown={(event) => startHold(event, direction)}
        // Pointer presses are handled above; this is the keyboard (Enter or Space).
        onClick={(event) => {
          if (event.detail === 0) {
            press(direction);
          }
        }}
        onContextMenu={(event) => event.preventDefault()}
        className={`grid shrink-0 touch-manipulation place-items-center rounded-full text-muted transition select-none hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent ${isVertical ? 'size-6' : 'size-8'}`}
      >
        <Icon className={isVertical ? 'size-3.5' : 'size-4'} />
      </button>
    );
  };

  return (
    <div
      className={`flex items-center ${isVertical ? 'min-h-0 flex-1 flex-col-reverse gap-1' : 'gap-1.5'}`}
    >
      {button(-1)}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        {...(valueText === undefined ? {} : { 'aria-valuetext': valueText })}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`cursor-pointer accent-[var(--accent)] ${isVertical ? 'min-h-0 w-full flex-1 [writing-mode:vertical-lr] [direction:rtl]' : 'min-w-0 flex-1'} ${className}`}
      />
      {button(1)}
    </div>
  );
}
