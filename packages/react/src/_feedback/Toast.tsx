"use client";
import type { ReactNode } from "react";
import { toast as sonnerToast, Toaster } from "sonner";

/** Mount once near the root of the admin shell. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
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
    </>
  );
}

export interface ToastApi {
  success: (message: string, options?: { description?: string }) => void;
  error: (message: string, options?: { description?: string }) => void;
  info: (message: string, options?: { description?: string }) => void;
  warning: (message: string, options?: { description?: string }) => void;
  dismiss: (id?: string | number) => void;
}

/** Returns an imperative toast API. Callable from any client component. */
export function useToast(): ToastApi {
  return {
    success: (message, options) => {
      sonnerToast.success(message, options);
    },
    error: (message, options) => {
      sonnerToast.error(message, options);
    },
    info: (message, options) => {
      sonnerToast(message, options);
    },
    warning: (message, options) => {
      sonnerToast.warning(message, options);
    },
    dismiss: (id) => {
      sonnerToast.dismiss(id);
    },
  };
}

/** Direct toast handle — matches sonner's API surface for advanced callers. */
export { sonnerToast as Toast };
