import React, { useState, useEffect, useRef } from "react";

export interface Command {
  id: string;
  label: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Small timeout to ensure DOM is ready
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const cmd = filtered[selected];
      if (cmd) { cmd.action(); onClose(); }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)" }}
      />
      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: "fixed", top: "20vh", left: "50%", transform: "translateX(-50%)",
          width: 480, zIndex: 70,
          background: "var(--fp-surface-1)",
          border: "1px solid var(--fp-border-2)",
          borderRadius: 12, overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Type to filter..."
          style={{
            width: "100%", padding: "14px 16px",
            background: "transparent", border: "none",
            borderBottom: "1px solid var(--fp-border-1)",
            color: "var(--fp-text-1)", fontSize: 14,
            outline: "none", boxSizing: "border-box",
          }}
          aria-autocomplete="list"
          aria-controls="fp-palette-list"
          aria-activedescendant={filtered[selected] ? `fp-palette-item-${filtered[selected]!.id}` : undefined}
        />
        <div
          id="fp-palette-list"
          role="listbox"
          aria-label="Commands"
          style={{ maxHeight: 320, overflowY: "auto" }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "20px 16px", color: "var(--fp-text-3)", fontSize: 13, textAlign: "center" }}>
              No commands found
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                id={`fp-palette-item-${cmd.id}`}
                role="option"
                aria-selected={i === selected}
                onClick={() => { cmd.action(); onClose(); }}
                style={{
                  padding: "10px 16px", fontSize: 13, cursor: "pointer",
                  background: i === selected ? "var(--fp-surface-2)" : undefined,
                  color: "var(--fp-text-1)",
                  transition: `background var(--fp-duration) ease`,
                }}
              >
                {cmd.label}
              </div>
            ))
          )}
        </div>
        {/* Keyboard hint */}
        <div style={{
          padding: "8px 16px",
          borderTop: "1px solid var(--fp-border-1)",
          display: "flex", gap: 16, fontSize: 11, color: "var(--fp-text-3)",
        }}>
          <span><kbd style={{ fontFamily: "inherit" }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ fontFamily: "inherit" }}>↵</kbd> select</span>
          <span><kbd style={{ fontFamily: "inherit" }}>Esc</kbd> close</span>
        </div>
      </div>
    </>
  );
}
