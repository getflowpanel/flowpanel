import type React from "react";
import { useEffect, useRef } from "react";
import { renderDrawerSections } from "./drawer-sections/index.js";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  loading?: boolean;
  sections?: Array<{ type: string; data: unknown; error?: string }>;
  actions?: Array<{ label: string; onClick: () => void; variant?: string }>;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  loading,
  sections,
  actions,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    // Remember what was focused before opening
    lastFocusedRef.current = document.activeElement;

    const el = drawerRef.current;
    if (!el) return;

    // Focus first focusable element
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        // biome-ignore lint/style/noNonNullAssertion: el is guaranteed non-null inside this listener
        const focusableNow = el!.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusableNow[0];
        const last = focusableNow[focusableNow.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus on close
      if (lastFocusedRef.current instanceof HTMLElement) {
        lastFocusedRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fp-drawer-title"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          maxWidth: 420,
          zIndex: 50,
          background: "var(--fp-surface-1)",
          borderLeft: "1px solid var(--fp-border-1)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column" as const,
          animation: "fp-slide-in 200ms var(--fp-ease-out, cubic-bezier(.22,.1,.36,1))",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--fp-border-1)",
            position: "sticky",
            top: 0,
            background: "var(--fp-surface-1)",
            zIndex: 1,
          }}
        >
          <h2
            id="fp-drawer-title"
            style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--fp-text-1)" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "transparent",
              border: "1px solid var(--fp-border-1)",
              color: "var(--fp-text-2)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, flex: 1 }}>
          {loading ? (
            <>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 60,
                    borderRadius: 8,
                    background: "var(--fp-surface-2, #e5e7eb)",
                    marginBottom: 12,
                    animation: "fp-pulse 1.5s ease-in-out infinite",
                  }}
                />
              ))}
            </>
          ) : (
            <>
              {sections && renderDrawerSections(sections)}
              {children}
            </>
          )}
        </div>

        {/* Actions footer */}
        {actions && actions.length > 0 && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              display: "flex",
              gap: 8,
              padding: "12px 24px",
              borderTop: "1px solid var(--fp-border-1)",
              background: "var(--fp-surface-1)",
              zIndex: 1,
            }}
          >
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: "1px solid var(--fp-border-1)",
                  background: "transparent",
                  color: "var(--fp-text-1)",
                  cursor: "pointer",
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes fp-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes fp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 768px) {
          [role="dialog"][aria-modal="true"] {
            max-width: 100% !important;
          }
        }
      `}</style>
    </>
  );
}
