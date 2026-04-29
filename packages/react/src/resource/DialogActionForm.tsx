"use client";

/**
 * DialogActionForm — the form shown when the user invokes an `a.dialog`
 * action. Keeps values in local state, routes each declared field to the
 * matching control, and fires `onSubmit(values)` on form submit.
 *
 * Split out of ResourceActionButton.tsx so the button stays a short
 * dispatcher and the form's five field types have room to breathe.
 */

import type { DialogField, SerializedAction } from "@flowpanel/core";
import { useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { cn } from "../utils/cn";

interface DialogActionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: SerializedAction & { type: "dialog" };
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  loading: boolean;
}

export function DialogActionForm({
  open,
  onOpenChange,
  action,
  onSubmit,
  loading,
}: DialogActionFormProps) {
  const { schema } = action;
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const f of schema.fields) {
      initial[f.name] = f.defaultValue ?? "";
    }
    return initial;
  });

  const setField = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
    if (!loading) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void submit(e)}>
          <DialogHeader>
            <DialogTitle>{schema.title ?? action.label}</DialogTitle>
            {schema.description && <DialogDescription>{schema.description}</DialogDescription>}
          </DialogHeader>

          <div className="my-4 space-y-4">
            {schema.fields.map((field) => (
              <DialogFieldRow
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(v) => setField(field.name, v)}
              />
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={action.variant === "danger" ? "destructive" : "default"}
              loading={loading}
            >
              {schema.submitLabel ?? action.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogFieldRow({
  field,
  value,
  onChange,
}: {
  field: DialogField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `fp-dialog-${field.name}`;
  const label = field.label ?? field.name;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        field.type === "boolean" && "flex-row items-center justify-between",
      )}
    >
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {field.type === "text" && (
        <Input
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          disabled={false}
        />
      )}
      {field.type === "number" && (
        <Input
          id={id}
          type="number"
          value={(value as string | number) ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={field.placeholder}
          required={field.required}
        />
      )}
      {field.type === "textarea" && (
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={4}
        />
      )}
      {field.type === "boolean" && (
        <Switch id={id} checked={Boolean(value)} onCheckedChange={(v) => onChange(v)} />
      )}
      {field.type === "select" && (
        <select
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {!field.required && <option value="">—</option>}
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
      {field.type === "date" && (
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      )}
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
    </div>
  );
}
