"use client";
import { Check, Copy } from "lucide-react";
import * as React from "react";
import { useToast } from "../_feedback/Toast.js";
import { Button } from "../ui/button.js";

export interface CopyButtonProps {
  text: string;
  label?: string;
  /** Shows a success toast when true. Default: true. */
  toastOnSuccess?: boolean;
  className?: string;
}

export function CopyButton({
  text,
  label = "Copy",
  toastOnSuccess = true,
  className,
}: CopyButtonProps) {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);

  const onClick = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (toastOnSuccess) toast.success("Copied");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Copy failed");
    }
  }, [text, toast, toastOnSuccess]);

  const extra: { className?: string } = className ? { className } : {};

  return (
    <Button size="sm" variant="ghost" onClick={onClick} aria-label={label} {...extra}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="ml-1">{label}</span>
    </Button>
  );
}
