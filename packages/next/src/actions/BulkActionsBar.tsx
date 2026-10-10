"use client";
import { formatCount, formatLabel } from "@flowpanel/core/labels";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FlowpanelIcon,
  useApiBase,
  useFormatting,
  useLabels,
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
  const labels = useLabels();
  const { locale } = useFormatting();
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
          successMessage: formatLabel(labels.actions.ranOn, {
            label: action.label,
            n: selection.length,
          }),
          failureMessage: formatLabel(labels.errors.actionFailed, { label: action.label }),
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
      aria-label={labels.bulkBar.label}
      className="fp-mb-2 fp-flex fp-items-center fp-justify-between fp-gap-3 fp-rounded fp-border fp-border-line fp-bg-canvas fp-px-3 fp-py-2"
    >
      <div className="fp-text-sm fp-text-soft">
        {formatCount(labels.plurals?.selected ?? labels.bulkBar.selected, selection.length, locale)}
      </div>
      <div className="fp-flex fp-items-center fp-gap-2">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default" disabled={pending !== null}>
              {labels.bulkBar.choose}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((a) => (
              <DropdownMenuItem
                key={a.key}
                disabled={pending === a.key}
                onSelect={() => onActionPick(a)}
                className={a.variant === "destructive" ? "fp-text-err" : undefined}
              >
                {a.icon ? <FlowpanelIcon name={a.icon} className="fp-mr-2 fp-h-4 fp-w-4" /> : null}
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={pending !== null}>
          {labels.bulkBar.clear}
        </Button>
      </div>
      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          title={
            confirming.confirm?.title ??
            formatLabel(labels.actions.runConfirm, { label: confirming.label })
          }
          {...(confirming.confirm?.description
            ? { description: formatCount(confirming.confirm.description, selection.length, locale) }
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
            ? { description: formatCount(formAction.confirm.description, selection.length, locale) }
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
