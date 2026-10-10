"use client";
import { lazy, type ReactNode, Suspense } from "react";
import { type ToastApi, ToastContext } from "./toast-api";
import { dispatchToast } from "./toast-bridge";

// A toaster that cannot load leaves the page working, just without toasts.
const ToasterMount = lazy(() =>
  import("./ToasterMount").then(
    (m): { default: () => ReactNode } => m,
    () => ({ default: () => null }),
  ),
);

const API: ToastApi = {
  success: (message, options) => {
    dispatchToast((t) => {
      t.success(message, options);
    });
  },
  error: (message, options) => {
    dispatchToast((t) => {
      t.error(message, options);
    });
  },
  info: (message, options) => {
    dispatchToast((t) => {
      t(message, options);
    });
  },
  warning: (message, options) => {
    dispatchToast((t) => {
      t.warning(message, options);
    });
  },
  dismiss: (id) => {
    dispatchToast((t) => {
      t.dismiss(id);
    });
  },
};

/** Mount once near the root of the admin shell. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastContext.Provider value={API}>
      {children}
      <Suspense fallback={null}>
        <ToasterMount />
      </Suspense>
    </ToastContext.Provider>
  );
}
