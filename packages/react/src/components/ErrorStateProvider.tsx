import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface ErrorState {
  type: "auth" | "server" | "network" | "sse-disconnect" | null;
  message: string;
  details?: string;
  retryCount: number;
}

interface ErrorContextValue {
  error: ErrorState;
  reportError: (type: ErrorState["type"], message: string, details?: string) => void;
  clearError: () => void;
  retry: () => void;
}

const ErrorContext = createContext<ErrorContextValue>({
  error: { type: null, message: "", retryCount: 0 },
  reportError: () => {},
  clearError: () => {},
  retry: () => {},
});

export function useErrorState() {
  return useContext(ErrorContext);
}

interface ErrorStateProviderProps {
  children: React.ReactNode;
  onRetry?: () => void;
}

export function ErrorStateProvider({ children, onRetry }: ErrorStateProviderProps) {
  const [error, setError] = useState<ErrorState>({ type: null, message: "", retryCount: 0 });
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const reportError = useCallback((type: ErrorState["type"], message: string, details?: string) => {
    setError((prev) => ({ type, message, details, retryCount: prev.retryCount }));
  }, []);

  const clearError = useCallback(() => {
    setError({ type: null, message: "", retryCount: 0 });
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
  }, []);

  const retry = useCallback(() => {
    setError((prev) => {
      const nextRetry = prev.retryCount + 1;
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s max
      const delay = Math.min(1000 * 2 ** nextRetry, 16000);

      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        onRetry?.();
      }, delay);

      return { ...prev, retryCount: nextRetry };
    });
  }, [onRetry]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  return (
    <ErrorContext.Provider value={{ error, reportError, clearError, retry }}>
      {children}
      {error.type && <ErrorOverlay error={error} onRetry={retry} onDismiss={clearError} />}
    </ErrorContext.Provider>
  );
}

function ErrorOverlay({
  error,
  onRetry,
  onDismiss,
}: {
  error: ErrorState;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (error.type === "sse-disconnect") {
    return (
      <div
        role="alert"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }}
      >
        <div
          style={{
            background: "var(--fp-surface-1, #1a1a2e)",
            border: "1px solid var(--fp-border-1, #333)",
            borderRadius: 12,
            padding: "32px 40px",
            textAlign: "center",
            maxWidth: 400,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--fp-text-1, #fff)",
              marginBottom: 8,
            }}
          >
            Connection lost
          </div>
          <div style={{ fontSize: 13, color: "var(--fp-text-3, #888)", marginBottom: 16 }}>
            Reconnecting... (attempt {error.retryCount})
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid var(--fp-border-1, #333)",
              borderTopColor: "var(--fp-accent, #6366f1)",
              borderRadius: "50%",
              animation: "fp-spin 1s linear infinite",
              margin: "0 auto",
            }}
          />
        </div>
        <style>{`@keyframes fp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const colors: Record<string, { bg: string; border: string; text: string }> = {
    auth: { bg: "rgba(234,179,8,0.1)", border: "#eab308", text: "#eab308" },
    server: { bg: "rgba(239,68,68,0.1)", border: "#ef4444", text: "#ef4444" },
    network: { bg: "rgba(234,179,8,0.1)", border: "#eab308", text: "#eab308" },
  };
  const c = colors[error.type ?? "server"] ?? colors.server;

  const titles: Record<string, string> = {
    auth: "Session expired",
    server: "Server error",
    network: "Connection lost",
  };

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 56,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: "12px 20px",
        maxWidth: 480,
        width: "90%",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 2 }}>
          {titles[error.type ?? "server"]}
        </div>
        <div style={{ fontSize: 12, color: "var(--fp-text-3, #888)" }}>{error.message}</div>
        {error.details && (
          <details style={{ marginTop: 6, fontSize: 11, color: "var(--fp-text-3, #888)" }}>
            <summary style={{ cursor: "pointer" }}>Details</summary>
            <pre
              style={{ marginTop: 4, whiteSpace: "pre-wrap", fontFamily: "var(--fp-font-mono)" }}
            >
              {error.details}
            </pre>
          </details>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onRetry}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: `1px solid ${c.border}`,
            background: "transparent",
            color: c.text,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid var(--fp-border-1, #333)",
            background: "transparent",
            color: "var(--fp-text-3, #888)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
