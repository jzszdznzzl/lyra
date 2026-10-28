interface ToggleProps {
  label: string;
  hint?: string;
  isOn: boolean;
  isDisabled?: boolean;
  onChange: (isOn: boolean) => void;
}

export function Toggle({ label, hint, isOn, isDisabled = false, onChange }: ToggleProps) {
  return (
    <label
      aria-disabled={isDisabled}
      className="flex cursor-pointer items-center justify-between gap-4 text-sm aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <span className="flex flex-col gap-0.5">
        {label}
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={isOn}
        disabled={isDisabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-surface-2 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}
