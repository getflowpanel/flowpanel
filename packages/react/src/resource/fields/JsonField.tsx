import { useState } from "react";
import { cn } from "../../utils/cn";
import { Textarea } from "../../ui/textarea";
import type { FieldProps } from "./TextField";

export function JsonField({
  name,
  label,
  value,
  onChange,
  required,
  error,
  description,
  disabled,
}: FieldProps) {
  const serialize = (v: unknown) => {
    if (typeof v === "string") return v;
    return JSON.stringify(v, null, 2);
  };

  const [raw, setRaw] = useState(() => serialize(value));
  const [parseError, setParseError] = useState<string | null>(null);

  const handleChange = (text: string) => {
    setRaw(text);
    try {
      const parsed = JSON.parse(text);
      setParseError(null);
      onChange(parsed);
    } catch {
      setParseError("Invalid JSON");
    }
  };

  const combinedError = error ?? parseError ?? undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium leading-none">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Textarea
        id={name}
        name={name}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        rows={6}
        aria-invalid={!!combinedError}
        className={cn("font-mono text-xs", combinedError && "border-destructive")}
        spellCheck={false}
      />
      {description && !combinedError && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {combinedError && <p className="text-xs text-destructive">{combinedError}</p>}
    </div>
  );
}
