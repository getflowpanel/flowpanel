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
import type { SerializedRowAction } from "./row-action";
import { useActionRunner } from "./use-action-runner";

export interface RowActionsMenuProps {
  resource: string;
  id: string;
  actions: SerializedRowAction[];
}

export function RowActionsMenu({ resource, id, actions }: RowActionsMenuProps) {
  const apiBase = useApiBase();
  const runAction = useActionRunner();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<SerializedRowAction | null>(null);
  const [formAction, setFormAction] = React.useState<SerializedRowAction | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const menuActions = actions.filter((a) => a.placement !== "inline");
  const inlineActions = actions.filter((a) => a.placement === "inline");

  if (menuActions.length === 0 && inlineActions.length === 0) return null;

  async function execute(
    action: SerializedRowAction,
    input: Record<string, unknown> = {},
  ): Promise<ActionFormFieldErrors | null> {
    setPending(action.key);
    try {
      return await runAction(
        `${apiBase}/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/actions/${encodeURIComponent(action.key)}`,
        input,
        { successMessage: `${action.label} ran`, failureMessage: `${action.label} failed` },
      );
    } finally {
      setPending(null);
    }
  }

  function onActionClick(action: SerializedRowAction): void {
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
    <div
      role="toolbar"
      aria-label="Row actions"
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {inlineActions.map((a) => (
        <Button
          key={a.key}
          size="sm"
          variant={a.variant === "destructive" ? "destructive" : "outline"}
          disabled={pending === a.key}
          onClick={() => onActionClick(a)}
          aria-busy={pending === a.key || undefined}
        >
          {a.icon ? <FlowpanelIcon name={a.icon} className="h-4 w-4" /> : null}
          {a.label}
        </Button>
      ))}

      {menuActions.length > 0 ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Row actions"
              className="inline-flex h-7 w-7 items-center justify-center rounded-fp-sm text-fp-text-3 hover:bg-fp-bg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-accent"
              disabled={pending !== null}
            >
              <KebabIcon />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menuActions.map((a) => (
              <DropdownMenuItem
                key={a.key}
                disabled={pending === a.key}
                onSelect={() => onActionClick(a)}
                className={a.variant === "destructive" ? "text-fp-err" : undefined}
              >
                {a.icon ? <FlowpanelIcon name={a.icon} className="mr-2 h-4 w-4" /> : null}
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

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
          confirmLabel={confirming.confirm?.confirmLabel ?? confirming.label}
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

function KebabIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="12" cy="19" r="1.2" />
    </svg>
  );
}
