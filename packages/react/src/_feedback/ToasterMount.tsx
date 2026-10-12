"use client";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { bindToaster } from "./toast-bridge";

/** Child effects run first, so `<Toaster>` has already subscribed when this one binds. */
export default function ToasterMount() {
  useEffect(() => bindToaster(toast), []);

  return (
    <Toaster
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!fp-bg-surface !fp-border-line !fp-text-ink !fp-rounded-lg !fp-shadow-lg",
          title: "fp-text-sm fp-font-medium",
          description: "!fp-text-faint fp-text-sm",
          success: "[&_[data-icon]]:!fp-text-ok",
          error: "[&_[data-icon]]:!fp-text-err",
          warning: "[&_[data-icon]]:!fp-text-warn",
          info: "[&_[data-icon]]:!fp-text-accent",
          closeButton: "!fp-bg-surface !fp-border-line !fp-text-soft hover:!fp-bg-canvas",
        },
      }}
    />
  );
}
