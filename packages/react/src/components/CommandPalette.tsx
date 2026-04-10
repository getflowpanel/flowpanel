import type React from "react";
import { useEffect, useRef, useState } from "react";

export interface Command {
  id: string;
  label: string;
  action: () => void;
  category?: string;
  description?: string;
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

const RECENT_STORAGE_KEY = "fp-recent-commands";
const MAX_RECENT = 5;

function getRecentIds(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveRecentId(id: string): void {
  try {
    const ids = getRecentIds().filter((r) => r !== id);
    ids.unshift(id);
    sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    // sessionStorage not available
  }
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 5px",
  fontSize: 10,
  fontFamily: "var(--fp-font-mono)",
  background: "var(--fp-surface-3)",
  borderRadius: 3,
  border: "1px solid var(--fp-border-1)",
  color: "var(--fp-text-3)",
  lineHeight: 1.4,
};

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Responsive width
  useEffect(() => {
    if (!open) return;
    const el = paletteRef.current;
    if (!el) return;
    const mq = window.matchMedia("(max-width: 640px)");
    function apply() {
      if (!el) return;
      if (mq.matches) {
        el.style.width = "100%";
        el.style.top = "0";
        el.style.left = "0";
        el.style.transform = "none";
        el.style.borderRadius = "0";
      } else {
        el.style.width = "480px";
        el.style.top = "20vh";
        el.style.left = "50%";
        el.style.transform = "translateX(-50%)";
        el.style.borderRadius = "12px";
      }
    }
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [open]);

  if (!open) return null;

  // Build filtered list: recent first when query empty, fuzzy filter otherwise
  let filtered: Command[];
  if (query.trim() === "") {
    const recentIds = getRecentIds();
    const recentCmds = recentIds
      .map((id) => commands.find((c) => c.id === id))
      .filter((c): c is Command => c != null);
    const rest = commands.filter((c) => !recentIds.includes(c.id));
    filtered = [...recentCmds, ...rest];
  } else {
    filtered = commands.filter((c) => fuzzyMatch(query, c.label));
  }

  // Group by category
  const grouped: Array<{
    category: string | null;
    items: Array<{ cmd: Command; globalIndex: number }>;
  }> = [];
  let globalIdx = 0;
  const categoryMap = new Map<string | null, Array<{ cmd: Command; globalIndex: number }>>();

  for (const cmd of filtered) {
    const cat = cmd.category ?? null;
    if (!categoryMap.has(cat)) {
      const arr: Array<{ cmd: Command; globalIndex: number }> = [];
      categoryMap.set(cat, arr);
      grouped.push({ category: cat, items: arr });
    }
    categoryMap.get(cat)!.push({ cmd, globalIndex: globalIdx });
    globalIdx++;
  }

  function executeCommand(cmd: Command) {
    saveRecentId(cmd.id);
    cmd.action();
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const cmd = filtered[selected];
      if (cmd) executeCommand(cmd);
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
        ref={paletteRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: "fixed",
          top: "20vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: 480,
          zIndex: 70,
          background: "var(--fp-surface-1)",
          border: "1px solid var(--fp-border-2)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type to filter..."
          style={{
            width: "100%",
            padding: "14px 16px",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--fp-border-1)",
            color: "var(--fp-text-1)",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
          aria-autocomplete="list"
          aria-controls="fp-palette-list"
          aria-activedescendant={
            filtered[selected] ? `fp-palette-item-${filtered[selected]?.id}` : undefined
          }
        />
        <div
          id="fp-palette-list"
          role="listbox"
          aria-label="Commands"
          style={{ maxHeight: 320, overflowY: "auto" }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "20px 16px",
                color: "var(--fp-text-3)",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              No commands found
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category ?? "__none"}>
                {group.category && (
                  <div
                    style={{
                      padding: "8px 16px 4px",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--fp-text-4)",
                    }}
                  >
                    {group.category}
                  </div>
                )}
                {group.items.map(({ cmd, globalIndex }) => (
                  <div
                    key={cmd.id}
                    id={`fp-palette-item-${cmd.id}`}
                    role="option"
                    aria-selected={globalIndex === selected}
                    onClick={() => executeCommand(cmd)}
                    style={{
                      padding: "10px 16px",
                      fontSize: 13,
                      cursor: "pointer",
                      background: globalIndex === selected ? "var(--fp-surface-2)" : undefined,
                      color: "var(--fp-text-1)",
                      transition: `background var(--fp-duration) ease`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div>{cmd.label}</div>
                      {cmd.description && (
                        <div style={{ fontSize: 11, color: "var(--fp-text-3)", marginTop: 2 }}>
                          {cmd.description}
                        </div>
                      )}
                    </div>
                    {cmd.shortcut && <kbd style={kbdStyle}>{cmd.shortcut}</kbd>}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        {/* Keyboard hint */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--fp-border-1)",
            display: "flex",
            gap: 16,
            fontSize: 11,
            color: "var(--fp-text-3)",
          }}
        >
          <span>
            <kbd style={{ fontFamily: "inherit" }}>↑↓</kbd> navigate
          </span>
          <span>
            <kbd style={{ fontFamily: "inherit" }}>↵</kbd> select
          </span>
          <span>
            <kbd style={{ fontFamily: "inherit" }}>Esc</kbd> close
          </span>
        </div>
      </div>
    </>
  );
}
