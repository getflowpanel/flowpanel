import { cn } from "../../utils/cn";
import { Textarea } from "../../ui/textarea";
import type { FieldProps } from "./TextField";

export function TextareaField({
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
      <label htmlFor={name} className="text-sm font-medium leading-none">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Textarea
        id={name}
        name={name}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        className={cn(error && "border-destructive")}
      />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
