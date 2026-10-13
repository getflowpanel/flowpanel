"use client";
import type { ResolvedLabels } from "@flowpanel/core/labels";
import * as React from "react";
import { useLabels } from "../provider/LabelsContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

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
  /** Defaults to the admin's own shortcuts, in its labels' language. */
  shortcuts?: ReadonlyArray<ShortcutSpec>;
}

export function ShortcutsCheatsheet({ open, onOpenChange, shortcuts }: ShortcutsCheatsheetProps) {
  const labels = useLabels();
  const list = shortcuts ?? adminShortcuts(labels);
  const grouped = React.useMemo(() => {
    const map = new Map<string, ShortcutSpec[]>();
    for (const s of list) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    return Array.from(map.entries());
  }, [list]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fp-max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.shortcuts.title}</DialogTitle>
          <DialogDescription className="fp-sr-only">{labels.shortcuts.hint}</DialogDescription>
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
                          {i > 0 ? (
                            <span className="fp-text-faint">{labels.shortcuts.or}</span>
                          ) : null}
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

/** The keys the admin binds: list rows, search, the command palette and this sheet. */
export function adminShortcuts(labels: ResolvedLabels): ShortcutSpec[] {
  const { shortcuts: words } = labels;
  return [
    { group: words.navigation, keys: ["j", "↓"], description: words.moveDown },
    { group: words.navigation, keys: ["k", "↑"], description: words.moveUp },
    { group: words.navigation, keys: ["g g"], description: words.first },
    { group: words.navigation, keys: ["G"], description: words.last },
    { group: words.rows, keys: ["Enter"], description: words.open },
    { group: words.general, keys: ["/"], description: words.search },
    { group: words.general, keys: ["⌘ K", "Ctrl K"], description: words.palette },
    { group: words.general, keys: ["?"], description: words.show },
    { group: words.general, keys: ["Esc"], description: words.close },
  ];
}
