import { cn } from "../../utils/cn";
import { Input } from "../../ui/input";
import type { FieldProps } from "./TextField";

export function DateField({
  name,
  label,
  value,
  onChange,
  required,
  error,
  description,
  disabled,
}: FieldProps) {
  // Normalize to YYYY-MM-DD for <input type="date">
  let inputValue = "";
  if (value instanceof Date) {
    inputValue = value.toISOString().split("T")[0];
  } else if (typeof value === "string" && value) {
    inputValue = value.split("T")[0];
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium leading-none">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Input
        id={name}
        name={name}
        type="date"
        value={inputValue}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
        aria-invalid={!!error}
        className={cn(error && "border-destructive")}
      />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
