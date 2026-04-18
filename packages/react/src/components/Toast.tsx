import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = "info" | "success" | "error";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Variant accent colors ────────────────────────────────────────────────────

const variantColor: Record<ToastVariant, string> = {
  info: "var(--fp-accent)",
  success: "var(--fp-ok)",
  error: "var(--fp-err)",
};

// ─── Single Toast ─────────────────────────────────────────────────────────────

interface ToastItemProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastItemComponent({ item, onDismiss }: ToastItemProps) {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => onDismiss(item.id), 120);
  }, [item.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "var(--fp-surface-3)",
        border: "1px solid var(--fp-border-2)",
        borderLeft: `3px solid ${variantColor[item.variant]}`,
        borderRadius: "var(--fp-radius-sm)",
        padding: "10px 14px",
        fontSize: 13,
        color: "var(--fp-text-1)",
        boxShadow: "var(--fp-shadow-md)",
        maxWidth: 320,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        animation: "fp-toast-in 150ms ease",
        opacity: dismissing ? 0 : 1,
        transform: dismissing ? "translateY(4px)" : "translateY(0)",
        transition: "opacity 100ms ease, transform 100ms ease",
      }}
    >
      <span style={{ flex: 1, lineHeight: "1.4" }}>{item.message}</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--fp-text-3)",
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const scheduleTimer = useCallback(
    (id: string, duration: number) => {
      if (duration === 0) return;
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = Math.random().toString(36).slice(2);
      const item: ToastItem = {
        id,
        message: opts.message,
        variant: opts.variant ?? "info",
        duration: opts.duration ?? 3000,
      };

      setToasts((prev) => {
        const next = [...prev, item];
        // If over the limit, drop the oldest and clear its timer
        if (next.length > MAX_VISIBLE) {
          const removed = next.splice(0, next.length - MAX_VISIBLE);
          for (const r of removed) {
            const timer = timers.current.get(r.id);
            if (timer !== undefined) {
              clearTimeout(timer);
              timers.current.delete(r.id);
            }
          }
        }
        return next;
      });

      scheduleTimer(id, item.duration);
    },
    [scheduleTimer],
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      for (const timer of timerMap.values()) {
        clearTimeout(timer);
      }
      timerMap.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 55,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {toasts.map((item) => (
          <div key={item.id} style={{ pointerEvents: "auto" }}>
            <ToastItemComponent item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
