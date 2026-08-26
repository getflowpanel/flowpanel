"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

/** Modal cheatsheet listing every shortcut bound on the page. */
export interface ShortcutSpec {
  /** Group label rendered as a section heading. */
  group: string;
  /** One or more keys that trigger the same action. Rendered as `<kbd>`. */
  keys: ReadonlyArray<string>;
  description: string;
}

export interface ShortcutsCheatsheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: ReadonlyArray<ShortcutSpec>;
}

export function ShortcutsCheatsheet({ open, onOpenChange, shortcuts }: ShortcutsCheatsheetProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, ShortcutSpec[]>();
    for (const s of shortcuts) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    return Array.from(map.entries());
  }, [shortcuts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {grouped.map(([group, items]) => (
            <section key={group}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fp-text-3">
                {group}
              </h4>
              <ul className="space-y-1.5">
                {items.map((s) => (
                  <li
                    key={s.description}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-fp-text-2">{s.description}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k, i) => (
                        <React.Fragment key={k}>
                          {i > 0 ? <span className="text-fp-text-3">or</span> : null}
                          <kbd className="rounded-fp-sm border border-fp-border-1 bg-fp-bg-2 px-1.5 py-0.5 font-mono text-xs text-fp-text-1">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The default shortcut list bundled with the resource list page. */
export const DEFAULT_SHORTCUTS: ReadonlyArray<ShortcutSpec> = [
  { group: "Navigation", keys: ["j", "↓"], description: "Move down a row" },
  { group: "Navigation", keys: ["k", "↑"], description: "Move up a row" },
  { group: "Navigation", keys: ["g g"], description: "Jump to first row" },
  { group: "Navigation", keys: ["G"], description: "Jump to last row" },
  { group: "Row", keys: ["Enter"], description: "Open drawer / detail" },
  { group: "Row", keys: ["e"], description: "Edit row" },
  { group: "Row", keys: ["d"], description: "Delete (with confirm)" },
  { group: "Search", keys: ["/"], description: "Focus search box" },
  { group: "Help", keys: ["?"], description: "Show this cheatsheet" },
  { group: "Help", keys: ["Esc"], description: "Close drawer / cheatsheet" },
];
