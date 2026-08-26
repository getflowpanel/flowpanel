"use client";
import { Button, ConfirmDialog, FlowpanelIcon, useApiBase } from "@flowpanel/react";
import * as React from "react";
import { ActionFormDialog } from "./ActionFormDialog";
import type { ActionFormFieldErrors } from "./action-form-field";
import type { SerializedDashboardAction } from "./dashboard-action";
import { useActionRunner } from "./use-action-runner";

/** Top-bar action row rendered in the dashboard header when `DashboardConfig.actions` is non-empty. */
export interface DashboardActionsBarProps {
  encodedPath: string;
  actions: SerializedDashboardAction[];
}

export function DashboardActionsBar({ encodedPath, actions }: DashboardActionsBarProps) {
  const apiBase = useApiBase();
  const runAction = useActionRunner();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<SerializedDashboardAction | null>(null);
  const [formAction, setFormAction] = React.useState<SerializedDashboardAction | null>(null);

  if (actions.length === 0) return null;

  async function execute(
    action: SerializedDashboardAction,
    input: Record<string, unknown> = {},
  ): Promise<ActionFormFieldErrors | null> {
    setPending(action.key);
    try {
      return await runAction(`${apiBase}/dashboards/${encodedPath}/actions/${action.key}`, input, {
        successMessage: `${action.label} ran`,
        failureMessage: `${action.label} failed`,
      });
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
