"use client";
import { lazy, type ReactNode, Suspense } from "react";
import { type ToastApi, ToastContext } from "./toast-api.js";
import { dispatchToast } from "./toast-bridge.js";

const ToasterMount = lazy(() => import("./ToasterMount.js"));

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
