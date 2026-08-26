"use client";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FlowpanelIcon,
  useApiBase,
} from "@flowpanel/react";
import * as React from "react";
import { ActionFormDialog } from "./ActionFormDialog";
import type { ActionFormFieldErrors } from "./action-form-field";
import type { SerializedBulkAction } from "./bulk-action";
import { useActionRunner } from "./use-action-runner";

export interface BulkActionsBarProps {
  resource: string;
  selection: string[];
  onClear: () => void;
  actions: SerializedBulkAction[];
}

export function BulkActionsBar({ resource, selection, onClear, actions }: BulkActionsBarProps) {
  const apiBase = useApiBase();
  const runAction = useActionRunner();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<SerializedBulkAction | null>(null);
  const [formAction, setFormAction] = React.useState<SerializedBulkAction | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  if (selection.length === 0 || actions.length === 0) return null;

  async function execute(
    action: SerializedBulkAction,
    input: Record<string, unknown> = {},
  ): Promise<ActionFormFieldErrors | null> {
    setPending(action.key);
    try {
      return await runAction(
        `${apiBase}/${encodeURIComponent(resource)}/bulk-actions/${encodeURIComponent(action.key)}`,
        { ids: selection, input },
        {
          successMessage: `${action.label} ran on ${selection.length}`,
          failureMessage: `${action.label} failed`,
          onRefreshed: onClear,
        },
      );
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
                {a.icon ? <FlowpanelIcon name={a.icon} className="mr-2 h-4 w-4" /> : null}
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
          confirmLabel={
            confirming.confirm?.confirmLabel ?? `${confirming.label} (${selection.length})`
          }
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
