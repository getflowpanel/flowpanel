"use client";
import {
  Button,
  ConfirmDialog,
  FlowpanelIcon,
  triggerDownload,
  useApiBase,
  useToast,
} from "@flowpanel/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ActionInputIssue } from "../runtime/action-schema";
import { ActionFormDialog } from "./ActionFormDialog";
import { type ActionFormFieldErrors, mapActionIssuesToFieldErrors } from "./action-form-field";
import type { SerializedDashboardAction } from "./dashboard-action";

/** Top-bar action row rendered in the dashboard header when `DashboardConfig.actions` is non-empty. */
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
  | { ok: false; error: string; issues?: ActionInputIssue[] };

export function DashboardActionsBar({ encodedPath, actions }: DashboardActionsBarProps) {
  const router = useRouter();
  const apiBase = useApiBase();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<SerializedDashboardAction | null>(null);
  const [formAction, setFormAction] = React.useState<SerializedDashboardAction | null>(null);

  if (actions.length === 0) return null;

  /** Runs the action. */
  async function execute(
    action: SerializedDashboardAction,
    input: Record<string, unknown> = {},
  ): Promise<ActionFormFieldErrors | null> {
    setPending(action.key);
    try {
      const res = await fetch(`${apiBase}/dashboards/${encodedPath}/actions/${action.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await res.json()) as ServerResult;

      if (!result.ok) {
        const fieldErrors = mapActionIssuesToFieldErrors(result.issues);
        if (fieldErrors) return fieldErrors;
        toast.error(result.error || `${action.label} failed`);
        return null;
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
      return null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      return null;
    } finally {
      setPending(null);
    }
  }

  function onClick(action: SerializedDashboardAction): void {
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
          {a.icon ? <FlowpanelIcon name={a.icon} className="h-4 w-4" /> : null}
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
        <ActionFormDialog
          title={formAction.confirm?.title ?? formAction.label}
          {...(formAction.confirm?.description
            ? { description: formAction.confirm.description }
            : {})}
          submitLabel={formAction.confirm?.confirmLabel ?? formAction.label}
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
    </div>
  );
}
