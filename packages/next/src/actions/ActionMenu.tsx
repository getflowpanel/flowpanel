"use client";
import type { IconName } from "@flowpanel/core";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FlowpanelIcon,
} from "@flowpanel/react";
import * as React from "react";
import { cn } from "../utils/cn";
import type { ActionFormField, ActionFormFieldErrors } from "./action-form-field";
import { useActionRunner } from "./use-action-runner";
import { preloadFormDialog, useFormDialog } from "./use-form-dialog";

/** One action as the menu runs it: where it posts, what it asks first, what it says after. */
export interface RunnableAction {
  key: string;
  label: string;
  icon?: IconName;
  variant?: "default" | "destructive" | "success";
  placement?: "inline" | "menu";
  confirm?: { title: string; description?: string; confirmLabel?: string };
  form?: ActionFormField[];
  url: string;
  method?: "POST" | "DELETE";
  successMessage?: string;
  failureMessage: string;
  redirectTo?: string;
  /** Opens a group below a line in the menu, as Delete does. */
  separated?: boolean;
  /** Runs after this action succeeded, instead of the menu's `onDone`. */
  onSuccess?: () => void;
}

export interface ActionMenuProps {
  actions: RunnableAction[];
  /** Name of the menu button. */
  label: string;
  /** `row` is the list's compact kebab; `header` sits beside a record's title. */
  look: "row" | "header";
  /** Buttons before the menu, such as Edit. */
  leading?: React.ReactNode;
  /** Runs after a successful action refreshed the page. */
  onDone?: () => void;
  /** The drawer's header: buttons as tall as its small ones. */
  dense?: boolean;
}

/** A record's actions: inline ones as buttons, the rest in one menu, each confirmed or asked for input first. */
export function ActionMenu({ actions, label, look, leading, onDone, dense }: ActionMenuProps) {
  const runAction = useActionRunner();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<RunnableAction | null>(null);
  const [formAction, setFormAction] = React.useState<RunnableAction | null>(null);
  const { FormDialog, whenLoaded } = useFormDialog();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const warm = actions.some((a) => a.form && a.form.length > 0) ? preloadFormDialog : undefined;
  const menuActions = actions.filter((a) => a.placement !== "inline");
  const inlineActions = actions.filter((a) => a.placement === "inline");
  if (menuActions.length === 0 && inlineActions.length === 0 && !leading) return null;

  async function execute(
    action: RunnableAction,
    input: Record<string, unknown> = {},
  ): Promise<ActionFormFieldErrors | null> {
    setPending(action.key);
    try {
      return await runAction(action.url, input, {
        failureMessage: action.failureMessage,
        ...(action.successMessage ? { successMessage: action.successMessage } : {}),
        ...(action.method ? { method: action.method } : {}),
        ...(action.redirectTo ? { redirectTo: action.redirectTo } : {}),
        ...((action.onSuccess ?? onDone) ? { onRefreshed: action.onSuccess ?? onDone } : {}),
      });
    } finally {
      setPending(null);
    }
  }

  function onActionClick(action: RunnableAction): void {
    setMenuOpen(false);
    if (action.form && action.form.length > 0) whenLoaded(() => setFormAction(action));
    else if (action.confirm) setConfirming(action);
    else void execute(action);
  }

  const trigger =
    look === "row" ? (
      <button
        type="button"
        aria-label={label}
        className="fp-inline-flex fp-h-7 fp-w-7 fp-shrink-0 fp-items-center fp-justify-center fp-rounded-sm fp-text-faint hover:fp-bg-canvas focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-accent"
        disabled={pending !== null}
      >
        <KebabIcon />
      </button>
    ) : (
      <Button
        variant="outline"
        size="icon"
        aria-label={label}
        disabled={pending !== null}
        {...(dense ? { className: "sm:fp-h-8 sm:fp-w-8" } : {})}
      >
        <KebabIcon />
      </Button>
    );

  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        "fp-flex fp-items-center fp-justify-end",
        look === "row" ? "-fp-my-1.5 fp-gap-1" : "fp-gap-2",
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerEnter={warm}
      onFocus={warm}
    >
      {leading}
      {inlineActions.map((a) => (
        <Button
          key={a.key}
          size={look === "row" || dense ? "sm" : "default"}
          variant={a.variant === "destructive" ? "destructive" : "outline"}
          disabled={pending === a.key}
          onClick={() => onActionClick(a)}
          aria-busy={pending === a.key || undefined}
        >
          {a.icon ? <FlowpanelIcon name={a.icon} className="fp-h-4 fp-w-4" /> : null}
          {a.label}
        </Button>
      ))}

      {menuActions.length > 0 ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" collisionPadding={12} className="fp-min-w-48">
            {menuActions.map((a, index) => (
              <React.Fragment key={a.key}>
                {a.separated && index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  disabled={pending === a.key}
                  onSelect={() => onActionClick(a)}
                  className={a.variant === "destructive" ? "fp-text-err" : undefined}
                >
                  {a.icon ? (
                    <FlowpanelIcon name={a.icon} className="fp-mr-2 fp-h-4 fp-w-4" />
                  ) : null}
                  {a.label}
                </DropdownMenuItem>
              </React.Fragment>
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
          title={confirming.confirm?.title ?? confirming.label}
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

      {formAction && FormDialog ? (
        <FormDialog
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
