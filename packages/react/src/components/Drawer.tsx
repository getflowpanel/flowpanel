import React, { useEffect, useRef } from "react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
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
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusableNow = el!.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.5)",
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fp-drawer-title"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 360, zIndex: 50,
          background: "var(--fp-surface-1)",
          borderLeft: "1px solid var(--fp-border-1)",
          overflowY: "auto",
          animation: "fp-slide-in 200ms cubic-bezier(.22,.1,.36,1)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px",
          borderBottom: "1px solid var(--fp-border-1)",
          position: "sticky", top: 0,
          background: "var(--fp-surface-1)",
          zIndex: 1,
        }}>
          <h2 id="fp-drawer-title" style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--fp-text-1)" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: "transparent", border: "1px solid var(--fp-border-1)",
              color: "var(--fp-text-2)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {children}
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes fp-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
