"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useReturnFocus } from "../lib/return-focus";
import { useLabels } from "../provider/LabelsContext";
import { DefaultButton } from "../ui/button-default";

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

/** "Delete these rows? This cannot be undone." reads as a short heading and a sentence under it. */
export function splitConfirmText(
  title: string,
  description: string | undefined,
): { heading: string; detail: string | undefined } {
  if (description) return { heading: title, detail: description };
  const match = /^(.+?[.?!])\s+(\S[\s\S]*)$/.exec(title.trim());
  return match?.[1] && match[2]
    ? { heading: match[1], detail: match[2] }
    : { heading: title, detail: undefined };
}

/** The registry default; it reads its button words from labels when the caller gives none. */
export function DefaultConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const labels = useLabels();
  const focus = useReturnFocus();
  const { heading, detail } = splitConfirmText(title, description);
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          data-flowpanel-portal=""
          className="fp-anim-overlay fp-fixed fp-inset-0 fp-z-50 fp-bg-overlay/70"
        />
        <AlertDialog.Content
          data-flowpanel-portal=""
          {...(detail ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={focus.remember}
          onCloseAutoFocus={focus.restore}
          className="fp-anim-dialog fp-fixed fp-left-1/2 fp-top-1/2 fp-z-50 fp-w-[min(420px,92vw)] -fp-translate-x-1/2 -fp-translate-y-1/2 fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-6 fp-shadow-lg"
        >
          <AlertDialog.Title className="fp-text-base fp-font-semibold fp-text-ink">
            {heading}
          </AlertDialog.Title>
          {detail ? (
            <AlertDialog.Description className="fp-mt-2 fp-text-sm fp-text-soft">
              {detail}
            </AlertDialog.Description>
          ) : null}
          <div className="fp-mt-5 fp-flex fp-justify-end fp-gap-2">
            <AlertDialog.Cancel asChild>
              <DefaultButton variant="ghost" size="sm">
                {cancelLabel ?? labels.confirm.cancel}
              </DefaultButton>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <DefaultButton
                variant={variant === "destructive" ? "destructive" : "default"}
                size="sm"
                onClick={() => void onConfirm()}
              >
                {confirmLabel ?? labels.confirm.ok}
              </DefaultButton>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
