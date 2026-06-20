"use client";
// LOC-OK: the modal shell and the per-field renderer share the same
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@flowpanel/react";
import * as React from "react";
import type { ActionFormField, ActionFormFieldErrors } from "./action-form-field.js";

export interface ActionFormDialogProps {
  /** Dialog title — typically `action.confirm?.title ?? action.label`. */
  title: string;
  description?: string;
  /** Submit button label — typically `action.confirm?.confirmLabel ?? action.label`. */
  submitLabel: string;
  variant?: "default" | "destructive";
  fields: ActionFormField[];
  onCancel: () => void;
  /** Runs the action. */
  onSubmit: (input: Record<string, unknown>) => Promise<ActionFormFieldErrors | null | undefined>;
}

function initialValues(fields: ActionFormField[]): Record<string, unknown> {
  const init: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "multiselect" || f.type === "tags") init[f.name] = [];
    else if (f.type === "boolean" || f.type === "checkbox" || f.type === "switch")
      init[f.name] = false;
    else init[f.name] = "";
  }
  return init;
}

/** Shared modal form for row / bulk / dashboard / drawer actions that declare `form: [...]`. */
export function ActionFormDialog({
  title,
  description,
  submitLabel,
  variant,
  fields,
  onCancel,
  onSubmit,
}: ActionFormDialogProps) {
  const [values, setValues] = React.useState<Record<string, unknown>>(() => initialValues(fields));
  const [fieldErrors, setFieldErrors] = React.useState<ActionFormFieldErrors | null>(null);
  const [pending, setPending] = React.useState(false);

  function setValue(name: string, v: unknown) {
    setValues((prev) => ({ ...prev, [name]: v }));
    setFieldErrors((prev) => {
      if (!prev || prev[name] === undefined) return prev;
      const { [name]: _omit, ...rest } = prev;
      return rest;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const errors = await onSubmit(values);
      setFieldErrors(errors ?? null);
    } finally {
      setPending(false);
    }
  }

  const formBannerError = fieldErrors?.[""];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="my-4 grid gap-4">
            {formBannerError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-fp-sm border border-fp-err/30 bg-fp-err/10 px-3 py-2 text-sm text-fp-err"
              >
                {formBannerError}
              </div>
            ) : null}
            {fields.map((f) => {
              const fieldError = fieldErrors?.[f.name];
              return (
                <ActionFormFieldInput
                  key={f.name}
                  field={f}
                  value={values[f.name]}
                  {...(fieldError !== undefined ? { error: fieldError } : {})}
                  onChange={(v) => setValue(f.name, v)}
                />
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={variant === "destructive" ? "destructive" : "default"}
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {pending ? "…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ActionFormFieldInputProps {
  field: ActionFormField;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}

function ActionFormFieldInput({ field, value, error, onChange }: ActionFormFieldInputProps) {
  const id = `action-form-field-${field.name}`;
  const errId = `${id}-error`;
  const label = field.label ?? field.name;
  const required = field.required ?? false;
  const type = field.type ?? "text";
  const hasError = Boolean(error);
  const aria = hasError ? { "aria-invalid": true as const, "aria-describedby": errId } : {};
  const errorNode = hasError ? (
    <p id={errId} className="text-xs text-fp-err" role="alert">
      {error}
    </p>
  ) : null;

  if (type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <textarea
          id={id}
          name={field.name}
          rows={4}
          required={required}
          {...(field.placeholder ? { placeholder: field.placeholder } : {})}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-fp border border-fp-border-1 bg-fp-bg-1 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-fp-accent"
          {...aria}
        />
        {errorNode ?? (field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null)}
      </div>
    );
  }

  if (type === "select") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <select
          id={id}
          name={field.name}
          required={required}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-fp border border-fp-border-1 bg-fp-bg-1 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-fp-accent"
          {...aria}
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errorNode ?? (field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null)}
      </div>
    );
  }

  if (type === "multiselect") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    const options = field.options ?? [];
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <fieldset
          aria-label={label}
          className="m-0 flex min-w-0 flex-wrap gap-2 rounded-fp border border-fp-border-1 bg-fp-bg-1 p-2"
        >
          {options.map((o) => {
            const checked = arr.includes(o.value);
            const itemId = `${id}-${o.value}`;
            return (
              <label
                key={o.value}
                htmlFor={itemId}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-fp-sm border border-fp-border-1 bg-fp-bg-2 px-2 py-1 text-xs"
              >
                <Checkbox
                  id={itemId}
                  checked={checked}
                  onCheckedChange={(next) => {
                    const set = new Set(arr);
                    if (next === true) set.add(o.value);
                    else set.delete(o.value);
                    onChange(Array.from(set));
                  }}
                  className="h-3.5 w-3.5"
                />
                {o.label}
              </label>
            );
          })}
        </fieldset>
        {errorNode ?? (field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null)}
      </div>
    );
  }

  if (type === "boolean" || type === "checkbox" || type === "switch") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            name={field.name}
            checked={Boolean(value)}
            onCheckedChange={(next) => onChange(next === true)}
            {...aria}
          />
          <Label htmlFor={id}>{label}</Label>
        </div>
        {errorNode ?? (field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null)}
      </div>
    );
  }

  if (type === "tags") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="text"
          required={required}
          {...(field.placeholder ? { placeholder: field.placeholder } : {})}
          value={arr.join(", ")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          {...aria}
        />
        {errorNode ?? (field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null)}
      </div>
    );
  }

  const inputType: React.HTMLInputTypeAttribute = (() => {
    switch (type) {
      case "number":
        return "number";
      case "email":
        return "email";
      case "url":
        return "url";
      case "password":
        return "password";
      case "date":
        return "date";
      case "datetime":
        return "datetime-local";
      case "time":
        return "time";
      case "color":
        return "color";
      default:
        return "text";
    }
  })();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={field.name}
        type={inputType}
        required={required}
        {...(field.placeholder ? { placeholder: field.placeholder } : {})}
        value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
        onChange={(e) => {
          if (inputType === "number") {
            const n = e.target.value === "" ? "" : Number(e.target.value);
            onChange(n);
          } else {
            onChange(e.target.value);
          }
        }}
        {...aria}
      />
      {errorNode ?? (field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null)}
    </div>
  );
}
