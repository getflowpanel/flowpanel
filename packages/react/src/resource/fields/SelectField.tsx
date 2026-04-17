import { cn } from "../../utils/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import type { FieldProps } from "./TextField";

interface SelectFieldProps extends FieldProps {
  options: string[];
}

export function SelectField({
  name,
  label,
  value,
  onChange,
  required,
  error,
  description,
  disabled,
  options,
}: SelectFieldProps) {
  const current = value === undefined || value === null ? "" : String(value);

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium leading-none">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Select
        value={current}
        onValueChange={(val) => onChange(val === "" ? undefined : val)}
        disabled={disabled}
      >
        <SelectTrigger
          id={name}
          className={cn(error && "border-destructive")}
          aria-invalid={!!error}
        >
          <SelectValue placeholder={`Select ${label}`} />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="">None</SelectItem>}
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
