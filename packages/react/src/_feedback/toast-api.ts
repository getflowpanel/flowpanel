"use client";
import { createContext, useContext } from "react";

export interface ToastApi {
  success: (message: string, options?: { description?: string }) => void;
  error: (message: string, options?: { description?: string }) => void;
  info: (message: string, options?: { description?: string }) => void;
  warning: (message: string, options?: { description?: string }) => void;
  dismiss: (id?: string | number) => void;
}

const NOOP = (): void => undefined;

/** No `ToastProvider` above us: nothing renders toasts, so nothing is dispatched. */
const UNMOUNTED: ToastApi = {
  success: NOOP,
  error: NOOP,
  info: NOOP,
  warning: NOOP,
  dismiss: NOOP,
};

export const ToastContext = createContext<ToastApi>(UNMOUNTED);

/** Returns an imperative toast API. Callable from any client component under `ToastProvider`. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}
