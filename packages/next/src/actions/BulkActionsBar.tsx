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

  // Up to three verbs sit on the bar itself; a longer list keeps two and folds the rest into the menu.
  const inline = actions.length <= 3 ? actions : actions.slice(0, 2);
  const folded = actions.slice(inline.length);
  return (
    <section
      aria-label={labels.bulkBar.label}
      className="fp-sticky fp-bottom-4 fp-z-30 fp-mx-auto fp-mt-3 fp-flex fp-w-fit fp-max-w-full fp-flex-wrap fp-items-center fp-gap-3 fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-py-2 fp-pl-4 fp-pr-2 fp-shadow-lg"
    >
      <div className="fp-whitespace-nowrap fp-text-sm fp-font-medium fp-tabular-nums fp-text-ink">
        {formatCount(labels.plurals?.selected ?? labels.bulkBar.selected, selection.length, locale)}
      </div>
      <span aria-hidden className="fp-h-5 fp-w-px fp-bg-line" />
      <div className="fp-flex fp-flex-wrap fp-items-center fp-gap-2">
        {inline.map((a) => (
          <Button
            key={a.key}
            size="sm"
            variant={a.variant === "destructive" ? "destructive" : "outline"}
            disabled={pending !== null}
            aria-busy={pending === a.key || undefined}
            onClick={() => onActionPick(a)}
          >
            {a.icon ? <FlowpanelIcon name={a.icon} className="fp-h-4 fp-w-4" /> : null}
            {a.label}
          </Button>
        ))}
        {folded.length > 0 ? (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending !== null}>
                {labels.bulkBar.choose}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {folded.map((a) => (
                <DropdownMenuItem
                  key={a.key}
                  disabled={pending === a.key}
                  onSelect={() => onActionPick(a)}
                  className={a.variant === "destructive" ? "fp-text-err" : undefined}
                >
                  {a.icon ? (
                    <FlowpanelIcon name={a.icon} className="fp-mr-2 fp-h-4 fp-w-4" />
                  ) : null}
                  {a.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
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
