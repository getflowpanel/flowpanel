import type React from "react";
import { useEffect, useRef } from "react";
import { renderDrawerSections } from "./drawer-sections/index.js";

interface DrawerAction {
  label: string;
  variant?: "default" | "danger";
  onClick: () => void;
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  sections?: Array<{ type: string; data: unknown; error?: string }>;
  run?: Record<string, unknown>;
  actions?: Array<DrawerAction>;
  loading?: boolean;
}

function SkeletonBlock({ height = 60 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 8,
        background: "var(--fp-surface-2)",
        marginBottom: 12,
        animation: "fp-skeleton-pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  sections,
  run,
  actions,
  loading,
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

  function renderContent() {
    if (loading) {
      return (
        <>
          <SkeletonBlock height={72} />
          <SkeletonBlock height={120} />
          <SkeletonBlock height={56} />
        </>
      );
    }
    if (sections) {
      return renderDrawerSections(sections, run);
    }
    return children;
  }

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
          WebkitBackdropFilter: "blur(4px)",
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
          width: 420,
          zIndex: 50,
          background: "var(--fp-surface-1)",
          borderLeft: "1px solid var(--fp-border-1)",
          overflowY: "auto",
          animation: "fp-slide-in 200ms cubic-bezier(.22,.1,.36,1)",
          display: "flex",
          flexDirection: "column",
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
            flexShrink: 0,
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
        <div style={{ padding: 24, flex: 1 }}>{renderContent()}</div>

        {/* Actions footer */}
        {actions && actions.length > 0 && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              background: "var(--fp-surface-1)",
              borderTop: "1px solid var(--fp-border-1)",
              padding: "12px 24px",
              display: "flex",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                style={{
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 6,
                  cursor: "pointer",
                  border: `1px solid ${action.variant === "danger" ? "var(--fp-err)" : "var(--fp-border-1)"}`,
                  background: "transparent",
                  color: action.variant === "danger" ? "var(--fp-err)" : "var(--fp-text-2)",
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fp-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes fp-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
}
