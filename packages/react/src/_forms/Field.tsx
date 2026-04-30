"use client";
import { getInputProps } from "@conform-to/react";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { useFormContext } from "./Form.js";

export interface FieldProps {
  name: string;
  label?: string;
  help?: string;
  placeholder?: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "url"
    | "number"
    | "date"
    | "datetime-local"
    | "time"
    | "search";
  autoComplete?: string;
}

export function Field({ name, label, help, placeholder, type = "text", autoComplete }: FieldProps) {
  const { fields } = useFormContext();
  const field = fields[name];
  if (!field) return null;

  const errId = `${field.id}-error`;
  const helpId = `${field.id}-help`;

  const inputProps = getInputProps(field, { type });
  const hasErrors = Boolean(field.errors && field.errors.length > 0);
  const describedBy = hasErrors ? errId : help ? helpId : undefined;

  return (
    <div className="space-y-1.5">
      {label ? <Label htmlFor={field.id}>{label}</Label> : null}
      <Input
        {...inputProps}
        {...(placeholder ? { placeholder } : {})}
        {...(autoComplete ? { autoComplete } : {})}
        {...(hasErrors ? { "aria-invalid": true } : {})}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
      />
      {help && !hasErrors ? (
        <p id={helpId} className="text-xs text-fp-text-3">
          {help}
        </p>
      ) : null}
      {hasErrors ? (
        <p id={errId} className="text-xs text-fp-err" role="alert">
          {field.errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}
