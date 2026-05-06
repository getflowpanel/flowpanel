"use client";
import { getInputProps } from "@conform-to/react";
import * as React from "react";
import { JsonEditor } from "../_data/JsonEditor.js";
import { TagInput } from "../_data/TagInput.js";
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
    | "search"
    | "textarea"
    | "json"
    | "tags";
  autoComplete?: string;
}

export function Field({ name, label, help, placeholder, type = "text", autoComplete }: FieldProps) {
  const { fields } = useFormContext();
  const field = fields[name];

  // All hooks are called unconditionally below to obey the rules of hooks.
  const rawValue = field?.value;

  const initialJson = React.useMemo(() => {
    if (rawValue === undefined || rawValue === null || rawValue === "") return {};
    try {
      return typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    } catch {
      return {};
    }
  }, [rawValue]);
  const [jsonVal, setJsonVal] = React.useState<unknown>(initialJson);
  React.useEffect(() => {
    setJsonVal(initialJson);
  }, [initialJson]);

  const initialTags = React.useMemo<string[]>(() => {
    if (Array.isArray(rawValue)) return rawValue.map(String);
    if (typeof rawValue === "string" && rawValue) {
      return rawValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [rawValue]);
  const [tagsVal, setTagsVal] = React.useState<string[]>(initialTags);
  React.useEffect(() => {
    setTagsVal(initialTags);
  }, [initialTags]);

  if (!field) return null;

  const errId = `${field.id}-error`;
  const helpId = `${field.id}-help`;
  const hasErrors = Boolean(field.errors && field.errors.length > 0);
  const describedBy = hasErrors ? errId : help ? helpId : undefined;

  let control: React.ReactNode;

  if (type === "json") {
    control = (
      <>
        <input type="hidden" name={name} value={JSON.stringify(jsonVal)} id={field.id} />
        <JsonEditor value={jsonVal} onChange={setJsonVal} />
      </>
    );
  } else if (type === "tags") {
    control = (
      <>
        <input type="hidden" name={name} value={tagsVal.join(",")} id={field.id} />
        <TagInput value={tagsVal} onChange={setTagsVal} />
      </>
    );
  } else if (type === "textarea") {
    const inputProps = getInputProps(field, { type: "text" });
    control = (
      <textarea
        {...inputProps}
        rows={4}
        {...(placeholder ? { placeholder } : {})}
        {...(hasErrors ? { "aria-invalid": true } : {})}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        className="w-full rounded-fp border border-fp-border-1 bg-fp-bg-1 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-fp-accent"
      />
    );
  } else {
    const inputProps = getInputProps(field, { type });
    control = (
      <Input
        {...inputProps}
        {...(placeholder ? { placeholder } : {})}
        {...(autoComplete ? { autoComplete } : {})}
        {...(hasErrors ? { "aria-invalid": true } : {})}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {label ? <Label htmlFor={field.id}>{label}</Label> : null}
      {control}
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
