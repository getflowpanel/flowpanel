"use client";
// LOC-OK: orchestrates the dashboard-action bar end-to-end — button row,
// confirm dialog, form modal, and per-field renderer. Splitting the
// per-field switch into its own file is plausible but the modal needs the
// same `values` state object as the parent, so the two parts read more
// naturally as one component file.
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  triggerDownload,
  useToast,
} from "@flowpanel/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type {
  SerializedDashboardAction,
  SerializedDashboardActionField,
} from "./dashboard-action.js";

/**
 * Top-bar action row rendered in the dashboard header when
 * `DashboardConfig.actions` is non-empty.
 *
 * Each action is a flat inline button (no kebab menu — dashboards
 * typically host 0–3 actions, not 10+). On click:
 *
 * 1. If `action.confirm` is set → show the AlertDialog confirm.
 * 2. POST `/api/flowpanel/dashboards/<encodedPath>/actions/<key>`.
 * 3. Surface the `ActionResult`:
 *    - `ok: true` + `message` → success toast (falls back to "<label> ran")
 *    - `ok: true` + `download` → browser download via `triggerDownload`
 *    - `ok: true` + `redirect` → navigate via `router.push`
 *    - `ok: false` → error toast with the message
 * 4. `router.refresh()` so the dashboard widgets re-fetch
 *    (unless we navigated away).
 *
 * `requireRole` is enforced server-side; if a user without permission
 * clicks an action the server returns 403 and the error toast surfaces it.
 */
export interface DashboardActionsBarProps {
  encodedPath: string;
  actions: SerializedDashboardAction[];
}

type ServerResult =
  | {
      ok: true;
      message?: string;
      redirect?: string;
      download?: { filename: string; data: string; mime?: string };
    }
  | { ok: false; error: string };

export function DashboardActionsBar({ encodedPath, actions }: DashboardActionsBarProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<SerializedDashboardAction | null>(null);
  const [formAction, setFormAction] = React.useState<SerializedDashboardAction | null>(null);

  if (actions.length === 0) return null;

  async function execute(
    action: SerializedDashboardAction,
    input: Record<string, unknown> = {},
  ): Promise<void> {
    setPending(action.key);
    try {
      const res = await fetch(`/api/flowpanel/dashboards/${encodedPath}/actions/${action.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await res.json()) as ServerResult;

      if (!result.ok) {
        toast.error(result.error || `${action.label} failed`);
        return;
      }

      toast.success(result.message ?? `${action.label} ran`);

      if (result.download) {
        triggerDownload(result.download);
      }
      if (result.redirect) {
        router.push(result.redirect);
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(null);
    }
  }

  function onClick(action: SerializedDashboardAction): void {
    // hasForm wins over confirm — the form modal can host the confirm copy
    // at the top, so we never need two modals in sequence.
    if (action.hasForm) {
      setFormAction(action);
      return;
    }
    if (action.confirm) {
      setConfirming(action);
      return;
    }
    void execute(action);
  }

  return (
    <div className="flex items-center gap-2">
      {actions.map((a) => (
        <Button
          key={a.key}
          size="sm"
          variant={
            a.variant === "destructive"
              ? "destructive"
              : a.variant === "success"
                ? "default"
                : "default"
          }
          disabled={pending === a.key}
          onClick={() => onClick(a)}
          aria-busy={pending === a.key || undefined}
        >
          {a.label}
        </Button>
      ))}

      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          title={confirming.confirm?.title ?? "Are you sure?"}
          {...(confirming.confirm?.description
            ? { description: confirming.confirm.description }
            : {})}
          confirmLabel={confirming.confirm?.confirmLabel ?? "Confirm"}
          variant={confirming.variant === "destructive" ? "destructive" : "default"}
          onConfirm={() => {
            const action = confirming;
            setConfirming(null);
            void execute(action);
          }}
        />
      ) : null}

      {formAction ? (
        <DashboardActionFormDialog
          action={formAction}
          onCancel={() => setFormAction(null)}
          onSubmit={(input) => {
            const action = formAction;
            setFormAction(null);
            void execute(action, input);
          }}
        />
      ) : null}
    </div>
  );
}

interface DashboardActionFormDialogProps {
  action: SerializedDashboardAction;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}

/**
 * Modal form rendered when a dashboard action declares `form: [...]`.
 *
 * Mirrors the supported `FieldDef` types as closely as a self-contained
 * client renderer allows: text/number/email/url/password, textarea,
 * select, multiselect, boolean (checkbox), tags (comma-separated), and
 * date/datetime. Anything unrecognized falls back to a plain text input.
 *
 * If `action.confirm` is set, its copy renders at the top of the dialog
 * so the form modal subsumes the confirm prompt (no two modals in a row).
 */
function DashboardActionFormDialog({ action, onCancel, onSubmit }: DashboardActionFormDialogProps) {
  const fields = action.form ?? [];
  const [values, setValues] = React.useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === "multiselect" || f.type === "tags") init[f.name] = [];
      else if (f.type === "boolean" || f.type === "checkbox" || f.type === "switch")
        init[f.name] = false;
      else init[f.name] = "";
    }
    return init;
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(values);
  }

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
            <DialogTitle>{action.confirm?.title ?? action.label}</DialogTitle>
            {action.confirm?.description ? (
              <DialogDescription>{action.confirm.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="my-4 grid gap-4">
            {fields.map((f) => (
              <DashboardActionField
                key={f.name}
                field={f}
                value={values[f.name]}
                onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
              />
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={action.variant === "destructive" ? "destructive" : "default"}
            >
              {action.confirm?.confirmLabel ?? action.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DashboardActionFieldProps {
  field: SerializedDashboardActionField;
  value: unknown;
  onChange: (v: unknown) => void;
}

function DashboardActionField({ field, value, onChange }: DashboardActionFieldProps) {
  const id = `dashboard-action-${field.name}`;
  const label = field.label ?? field.name;
  const required = field.required ?? false;
  const type = field.type ?? "text";

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
        />
        {field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null}
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
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null}
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
                <input
                  id={itemId}
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(arr);
                    if (e.target.checked) next.add(o.value);
                    else next.delete(o.value);
                    onChange(Array.from(next));
                  }}
                  className="h-3.5 w-3.5 accent-fp-accent"
                />
                {o.label}
              </label>
            );
          })}
        </fieldset>
        {field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null}
      </div>
    );
  }

  if (type === "boolean" || type === "checkbox" || type === "switch") {
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={field.name}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-fp-accent"
        />
        <Label htmlFor={id}>{label}</Label>
        {field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null}
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
        />
        {field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null}
      </div>
    );
  }

  // Default: scalar input (text/number/email/url/password/date/datetime/time).
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
      />
      {field.help ? <p className="text-xs text-fp-text-3">{field.help}</p> : null}
    </div>
  );
}
