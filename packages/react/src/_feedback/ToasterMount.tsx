"use client";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { bindToaster } from "./toast-bridge.js";

/** Child effects run first, so `<Toaster>` has already subscribed when this one binds. */
export default function ToasterMount() {
  useEffect(() => bindToaster(toast), []);

  return (
    <Toaster
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!bg-fp-bg-1 !border-fp-border-1 !text-fp-text-1 !rounded-fp-lg !shadow-fp-lg",
          title: "text-sm font-medium",
          description: "!text-fp-text-3 text-sm",
          success: "[&_[data-icon]]:!text-fp-ok",
          error: "[&_[data-icon]]:!text-fp-err",
          warning: "[&_[data-icon]]:!text-fp-warn",
          info: "[&_[data-icon]]:!text-fp-accent",
          closeButton: "!bg-fp-bg-1 !border-fp-border-1 !text-fp-text-2 hover:!bg-fp-bg-2",
        },
      }}
    />
  );
}
