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
      <DialogContent className="fp-max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="fp-space-y-4">
          {grouped.map(([group, items]) => (
            <section key={group}>
              <h4 className="fp-mb-2 fp-text-xs fp-font-medium fp-text-soft">{group}</h4>
              <ul className="fp-space-y-1.5">
                {items.map((s) => (
                  <li
                    key={s.description}
                    className="fp-flex fp-items-center fp-justify-between fp-gap-3 fp-text-sm"
                  >
                    <span className="fp-text-soft">{s.description}</span>
                    <span className="fp-flex fp-shrink-0 fp-items-center fp-gap-1">
                      {s.keys.map((k, i) => (
                        <React.Fragment key={k}>
                          {i > 0 ? <span className="fp-text-faint">or</span> : null}
                          <kbd className="fp-rounded-sm fp-border fp-border-line fp-bg-canvas fp-px-1.5 fp-py-0.5 fp-font-mono fp-text-xs fp-text-ink">
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
