import { Switch } from "../../ui/switch";
import type { FieldProps } from "./TextField";

export function SwitchField({
  name,
  label,
  value,
  onChange,
  required,
  error,
  description,
  disabled,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <Switch
          id={name}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
          disabled={disabled}
          aria-invalid={!!error}
        />
        <label htmlFor={name} className="text-sm font-medium leading-none cursor-pointer">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
