"use client";
import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { type ToastApi, ToastContext } from "./toast-api";
import { dispatchToast, onFirstToast } from "./toast-bridge";

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
  const [wanted, setWanted] = useState(false);
  // Mounted while the page is idle, so its live region is in place before the first toast to announce it.
  useEffect(() => {
    const mount = () => setWanted(true);
    const stop = onFirstToast(mount);
    if (typeof requestIdleCallback === "function") {
      const idle = requestIdleCallback(mount, { timeout: 3000 });
      return () => {
        cancelIdleCallback(idle);
        stop();
      };
    }
    const timer = setTimeout(mount, 1500);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, []);
  return (
    <ToastContext.Provider value={API}>
      {children}
      {wanted ? (
        <Suspense fallback={null}>
          <ToasterMount />
        </Suspense>
      ) : null}
    </ToastContext.Provider>
  );
}
