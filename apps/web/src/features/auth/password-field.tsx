import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_SCORE } from '@lyra/shared';

import { TextField } from '../../ui/text-field.tsx';
import { passwordScore } from './password-strength.ts';

const SEGMENTS = [0, 1, 2, 3];
const SCORE_COLORS = ['bg-red-500', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'];
const SCORE_LABELS = [
  'auth.strength.0',
  'auth.strength.1',
  'auth.strength.2',
  'auth.strength.3',
  'auth.strength.4',
] as const;

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  userInputs: string[];
  onStrengthChange: (isStrong: boolean) => void;
  error?: string | null;
}

/** New-password input with the same strength rule the server applies. */
export function PasswordField({
  label,
  value,
  onChange,
  userInputs,
  onStrengthChange,
  error = null,
}: PasswordFieldProps) {
  const { t } = useTranslation();
  const [score, setScore] = useState<number | null>(null);
  const inputsKey = userInputs.join('\n');

  useEffect(() => {
    let isCurrent = true;

    if (value.length === 0) {
      return;
    }

    passwordScore(value, inputsKey.split('\n'))
      .then((next) => {
        if (isCurrent) {
          setScore(next);
          onStrengthChange(value.length >= PASSWORD_MIN_LENGTH && next >= PASSWORD_MIN_SCORE);
        }
      })
      .catch(() => {
        // Without the meter the server still checks the password on submit.
        onStrengthChange(value.length >= PASSWORD_MIN_LENGTH);
      });

    return () => {
      isCurrent = false;
    };
  }, [value, inputsKey, onStrengthChange]);

  const shownScore = value.length === 0 ? null : score;
  const isWeak = shownScore !== null && shownScore < PASSWORD_MIN_SCORE;

  return (
    <TextField
      label={label}
      type="password"
      autoComplete="new-password"
      required
      minLength={PASSWORD_MIN_LENGTH}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      hint={
        shownScore === null ? null : (
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex gap-1" aria-hidden>
              {SEGMENTS.map((segment) => (
                <span
                  key={segment}
                  className={`h-1 flex-1 rounded-full ${segment < shownScore ? SCORE_COLORS[shownScore] : 'bg-surface-2'}`}
                />
              ))}
            </div>
            <span>
              {t('auth.strength.label')}: {t(SCORE_LABELS[shownScore] ?? 'auth.strength.0')}
              {isWeak ? ` — ${t('auth.strength.required')}` : ''}
            </span>
          </div>
        )
      }
    />
  );
}
