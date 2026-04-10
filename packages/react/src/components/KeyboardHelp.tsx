import type React from "react";
import { useEffect, useRef } from "react";

interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutEntry {
  keys: string[];
  description: string;
}

const GROUPS: Array<{ title: string; shortcuts: ShortcutEntry[] }> = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["1"], description: "Switch to first tab" },
      { keys: ["2"], description: "Switch to second tab" },
      { keys: ["3"], description: "Switch to third tab" },
      { keys: ["Esc"], description: "Close overlay" },
    ],
  },
  {
    title: "Run Table",
    shortcuts: [
      { keys: ["j"], description: "Next row" },
      { keys: ["k"], description: "Previous row" },
      { keys: ["↵"], description: "Open run details" },
    ],
  },
  {
    title: "Drawer",
    shortcuts: [{ keys: ["Esc"], description: "Close drawer" }],
  },
];

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  fontSize: 11,
  fontFamily: "var(--fp-font-mono)",
  background: "var(--fp-surface-3)",
  borderRadius: 4,
  border: "1px solid var(--fp-border-1)",
  color: "var(--fp-text-2)",
  lineHeight: 1.4,
  minWidth: 20,
  textAlign: "center",
};

export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 80,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
        }}
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 480,
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          zIndex: 90,
          background: "var(--fp-surface-1)",
          border: "1px solid var(--fp-border-2)",
          borderRadius: 12,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--fp-border-1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fp-text-1)" }}>
            Keyboard Shortcuts
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "var(--fp-text-3)",
              cursor: "pointer",
              fontSize: 16,
              padding: "2px 6px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Groups */}
        <div style={{ padding: "12px 20px 20px" }}>
          {GROUPS.map((group) => (
            <div key={group.title} style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--fp-text-4)",
                  marginBottom: 8,
                }}
              >
                {group.title}
              </div>
              {group.shortcuts.map((sc) => (
                <div
                  key={sc.description}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 0",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--fp-text-2)" }}>{sc.description}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {sc.keys.map((k) => (
                      <kbd key={k} style={kbdStyle}>
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
