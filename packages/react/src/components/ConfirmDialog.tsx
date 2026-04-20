"use client";

import { Loader2, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Input } from "../ui/input";
import { cn } from "../utils/cn";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Text of the destructive confirm button. Default "Continue". */
  confirmLabel?: string;
  /** Text of the cancel button. Default "Cancel". */
  cancelLabel?: string;
  /** If set, user must type this string exactly to enable the confirm button. */
  typeToConfirm?: string;
  /** If true, apply destructive styling (red confirm button + warning icon). */
  destructive?: boolean;
  /** Called when user clicks confirm. May return a promise to show loading state. */
  onConfirm: () => void | Promise<void>;
}

/**
 * Production-grade confirm dialog. Supports optional type-to-confirm for
 * destructive actions and inline loading state during async confirm handlers.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Delete user?"
 *   description="This cannot be undone."
 *   typeToConfirm={user.email}
 *   destructive
 *   onConfirm={() => deleteUser(user.id)}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  typeToConfirm,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setInput("");
      setLoading(false);
    }
  }, [open]);

  const confirmEnabled = !loading && (!typeToConfirm || input === typeToConfirm);

  const handleConfirm = async () => {
    if (!confirmEnabled) return;
    try {
      setLoading(true);
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Caller is responsible for surfacing errors via toast
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => (loading ? null : onOpenChange(o))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {destructive && (
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            )}
            {title}
          </AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>

        {typeToConfirm && (
          <div className="space-y-2">
            <label htmlFor="fp-confirm-input" className="text-sm text-muted-foreground">
              Type{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-foreground">
                {typeToConfirm}
              </code>{" "}
              to confirm:
            </label>
            <Input
              id="fp-confirm-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              autoFocus
              disabled={loading}
              aria-label={`Type ${typeToConfirm} to confirm`}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!confirmEnabled}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className={cn(
              destructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
