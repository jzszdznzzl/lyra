import type { ButtonHTMLAttributes } from 'react';

export const ButtonVariant = Object.freeze({
  Primary: 'primary',
  Secondary: 'secondary',
  Ghost: 'ghost',
  Danger: 'danger',
} as const);

export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant];

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  [ButtonVariant.Primary]: 'bg-accent text-white shadow-lg shadow-accent/30 hover:brightness-110',
  [ButtonVariant.Secondary]: 'bg-surface-2 text-text border border-line hover:bg-surface',
  [ButtonVariant.Ghost]: 'text-muted hover:text-text hover:bg-surface',
  [ButtonVariant.Danger]: 'text-red-400 border border-red-400/30 hover:bg-red-400/10',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isBusy?: boolean;
}

export function Button({
  variant = ButtonVariant.Primary,
  isBusy = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled === true || isBusy}
      aria-busy={isBusy}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {isBusy ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
