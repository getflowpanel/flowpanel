"use client";

import type { DialogField, SerializedAction } from "@flowpanel/core";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button, buttonVariants } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { toast } from "../ui/sonner";
import { cn } from "../utils/cn";
import { getNestedValue } from "../utils/getNestedValue";

interface BaseProps {
  action: SerializedAction;
  resourceId: string;
  baseUrl: string;
  onSuccess?: () => void;
  className?: string;
  /** Used for mutation/dialog row context; leave undefined for bulk/collection. */
  row?: Record<string, unknown>;
  /** For bulk: selected row ids. */
  recordIds?: Array<string | number>;
  /** Button size override */
  size?: "sm" | "default";
}

function substituteHref(template: string, row: Record<string, unknown> | undefined): string {
  if (!row) return template;
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const v = getNestedValue(row, key.trim());
    return v === null || v === undefined ? "" : String(v);
  });
}

/**
 * Polymorphic action button that handles all five action kinds:
 * - mutation: per-row mutation, optional confirm
 * - bulk: applied to recordIds[]
 * - collection: toolbar-level, no row
 * - link: navigates (new tab or same window)
 * - dialog: opens a form dialog and submits values
 */
export function ResourceActionButton({
  action,
  resourceId,
  baseUrl,
  onSuccess,
  className,
  row,
  recordIds,
  size = "sm",
}: BaseProps) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!action.allowed) return null;

  const variant: "outline" | "destructive" =
    action.variant === "danger" ? "destructive" : "outline";

  // ──────────────────────────────────────────────────────────────
  // LINK action
  // ──────────────────────────────────────────────────────────────
  if (action.type === "link") {
    const href = substituteHref(action.href, row);
    if (!href) return null;
    return (
      <a
        href={href}
        target={action.external ? "_blank" : undefined}
        rel={action.external ? "noopener noreferrer" : undefined}
        className={cn(buttonVariants({ variant, size }), className)}
      >
        {action.label}
        {action.external && <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />}
      </a>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // MUTATION / BULK / COLLECTION / DIALOG — button-triggered
  // ──────────────────────────────────────────────────────────────
  const runNetwork = async (path: string, body: Record<string, unknown>) => {
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Server returned ${response.status}`);
      }
      // Handle optional download response
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        result = null;
      }
      const data = extractResultData(result);
      if (data && typeof data === "object" && "download" in data) {
        const dl = (data as { download?: { filename: string; content: string; mimeType?: string } })
          .download;
        if (dl) triggerDownload(dl);
      }
      toast.success(action.onSuccess?.toast ?? `${action.label} succeeded`);
      onSuccess?.();
    } catch (err) {
      toast.error(`${action.label} failed`, {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  const runMutation = () =>
    runNetwork("flowpanel.resource.action", {
      resourceId,
      actionId: action.id,
      recordId: row?.id,
    });

  const runBulk = () =>
    runNetwork("flowpanel.resource.actionBulk", {
      resourceId,
      actionId: action.id,
      recordIds: recordIds ?? [],
    });

  const runCollection = () =>
    runNetwork("flowpanel.resource.actionCollection", {
      resourceId,
      actionId: action.id,
    });

  const runDialog = async (values: Record<string, unknown>) => {
    await runNetwork("flowpanel.resource.actionDialog", {
      resourceId,
      actionId: action.id,
      values,
      recordId: row?.id,
    });
  };

  const requestRun = () => {
    if (action.confirm) {
      setConfirmOpen(true);
      return;
    }
    triggerRun();
  };

  const triggerRun = () => {
    if (action.type === "dialog") {
      setDialogOpen(true);
      return;
    }
    if (action.type === "mutation") void runMutation();
    else if (action.type === "bulk") void runBulk();
    else if (action.type === "collection") void runCollection();
  };

  const confirmTitle = action.confirm?.title ?? `${action.label}?`;
  const rawDesc = action.confirm?.description;
  const confirmDesc =
    (typeof rawDesc === "string" ? rawDesc : undefined) ??
    `Are you sure you want to ${action.label.toLowerCase()}?`;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={requestRun}
        disabled={loading || (action.type === "bulk" && (!recordIds || recordIds.length === 0))}
      >
        {loading ? "Running…" : action.label}
        {action.type === "bulk" && recordIds && recordIds.length > 0 && (
          <span className="ml-1.5 rounded bg-background/20 px-1.5 py-0.5 text-xs font-mono">
            {recordIds.length}
          </span>
        )}
      </Button>

      {action.confirm && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmTitle}
          description={confirmDesc}
          confirmLabel={action.confirm.confirmLabel ?? action.label}
          typeToConfirm={action.confirm.typeToConfirm}
          destructive={action.variant === "danger" || action.confirm.intent === "destructive"}
          onConfirm={triggerRun}
        />
      )}

      {action.type === "dialog" && (
        <DialogActionForm
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          action={action}
          onSubmit={runDialog}
          loading={loading}
        />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DialogActionForm
// ────────────────────────────────────────────────────────────────────────────

function DialogActionForm({
  open,
  onOpenChange,
  action,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: SerializedAction & { type: "dialog" };
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  loading: boolean;
}) {
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
              disabled={loading}
            >
              {loading ? "Running…" : (schema.submitLabel ?? action.label)}
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

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

function extractResultData(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "result" in raw) {
    const r = (raw as { result?: { data?: unknown } }).result;
    if (r && typeof r === "object" && "data" in r) return r.data;
  }
  return raw;
}

function triggerDownload(dl: { filename: string; content: string; mimeType?: string }) {
  const blob = new Blob([dl.content], { type: dl.mimeType ?? "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dl.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
