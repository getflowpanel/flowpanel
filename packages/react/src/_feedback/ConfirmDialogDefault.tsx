"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { DefaultButton } from "../ui/buttonDefault";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
}

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          data-flowpanel-portal=""
          className="fp-anim-overlay fp-fixed fp-inset-0 fp-z-50 fp-bg-overlay/70"
        />
        <AlertDialog.Content
          data-flowpanel-portal=""
          className="fp-anim-dialog fp-fixed fp-left-1/2 fp-top-1/2 fp-z-50 fp-w-[min(420px,92vw)] -fp-translate-x-1/2 -fp-translate-y-1/2 fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-6 fp-shadow-lg"
        >
          <AlertDialog.Title className="fp-text-base fp-font-semibold fp-text-ink">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description
            className={description ? "fp-mt-2 fp-text-sm fp-text-faint" : "fp-sr-only"}
          >
            {description ?? "Confirm action"}
          </AlertDialog.Description>
          <div className="fp-mt-5 fp-flex fp-justify-end fp-gap-2">
            <AlertDialog.Cancel asChild>
              <DefaultButton variant="ghost" size="sm">
                {cancelLabel}
              </DefaultButton>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <DefaultButton
                variant={variant === "destructive" ? "destructive" : "default"}
                size="sm"
                onClick={() => void onConfirm()}
              >
                {confirmLabel}
              </DefaultButton>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
