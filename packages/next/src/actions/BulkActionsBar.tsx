"use client";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  triggerDownload,
  useToast,
} from "@flowpanel/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ActionInputIssue } from "../runtime/action-helpers.js";
import { ActionFormDialog } from "./ActionFormDialog.js";
import { type ActionFormFieldErrors, mapActionIssuesToFieldErrors } from "./action-form-field.js";
import type { SerializedBulkAction } from "./bulk-action.js";

export interface BulkActionsBarProps {
  resource: string;
  selection: string[];
  onClear: () => void;
  actions: SerializedBulkAction[];
}

type ServerResult =
  | {
      ok: true;
      message?: string;
      redirect?: string;
      download?: { filename: string; data: string; mime?: string };
    }
  | { ok: false; error: string; issues?: ActionInputIssue[] };

export function BulkActionsBar({ resource, selection, onClear, actions }: BulkActionsBarProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<SerializedBulkAction | null>(null);
  const [formAction, setFormAction] = React.useState<SerializedBulkAction | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  if (selection.length === 0 || actions.length === 0) return null;

  /** Runs the action. */
  async function execute(
    action: SerializedBulkAction,
    input: Record<string, unknown> = {},
  ): Promise<ActionFormFieldErrors | null> {
    setPending(action.key);
    try {
      const res = await fetch(`/api/flowpanel/${resource}/bulk-actions/${action.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selection, input }),
      });
      const result = (await res.json()) as ServerResult;

      if (!result.ok) {
        const fieldErrors = mapActionIssuesToFieldErrors(result.issues);
        if (fieldErrors) return fieldErrors;
        toast.error(result.error || `${action.label} failed`);
        return null;
      }

      toast.success(result.message ?? `${action.label} ran on ${selection.length}`);

      if (result.download) {
        triggerDownload(result.download);
      }
      if (result.redirect) {
        router.push(result.redirect);
        return null;
      }
      onClear();
      router.refresh();
      return null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      return null;
    } finally {
      setPending(null);
    }
  }

  function onActionPick(action: SerializedBulkAction): void {
    setMenuOpen(false);
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
    <section
      aria-label="Bulk actions"
      className="mb-2 flex items-center justify-between gap-3 rounded-fp border border-fp-border-1 bg-fp-bg-2 px-3 py-2"
    >
      <div className="text-sm text-fp-text-2">
        <span className="font-medium text-fp-text-1">{selection.length}</span> selected
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default" disabled={pending !== null}>
              Action…
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((a) => (
              <DropdownMenuItem
                key={a.key}
                disabled={pending === a.key}
                onSelect={() => onActionPick(a)}
                className={a.variant === "destructive" ? "text-fp-err" : undefined}
              >
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={pending !== null}>
          Clear
        </Button>
      </div>
      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          title={confirming.confirm?.title ?? `Run ${confirming.label}?`}
          {...(confirming.confirm?.description
            ? { description: confirming.confirm.description }
            : {})}
          confirmLabel={`${confirming.label} (${selection.length})`}
          variant={confirming.variant === "destructive" ? "destructive" : "default"}
          onConfirm={async () => {
            const action = confirming;
            setConfirming(null);
            await execute(action);
          }}
        />
      ) : null}

      {formAction ? (
        <ActionFormDialog
          title={formAction.confirm?.title ?? formAction.label}
          {...(formAction.confirm?.description
            ? { description: formAction.confirm.description }
            : {})}
          submitLabel={`${formAction.label} (${selection.length})`}
          {...(formAction.variant === "destructive" ? { variant: "destructive" as const } : {})}
          fields={formAction.form ?? []}
          onCancel={() => setFormAction(null)}
          onSubmit={async (input) => {
            const fieldErrors = await execute(formAction, input);
            if (!fieldErrors) setFormAction(null);
            return fieldErrors;
          }}
        />
      ) : null}
    </section>
  );
}
