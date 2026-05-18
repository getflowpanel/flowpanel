"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { DefaultButton } from "../ui/buttonDefault.js";

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
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95">
          <AlertDialog.Title className="text-base font-semibold text-fp-text-1">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description
            className={description ? "mt-2 text-sm text-fp-text-3" : "sr-only"}
          >
            {description ?? "Confirm action"}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
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
