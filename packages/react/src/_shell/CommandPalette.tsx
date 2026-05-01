"use client";
import { Command } from "cmdk";
import type * as React from "react";

export interface CommandGroupUI {
  label: string;
  items: Array<{
    label: string;
    onSelect: () => void;
    icon?: React.ReactNode;
    shortcut?: string;
    keywords?: string[];
  }>;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: CommandGroupUI[];
  placeholder?: string;
  onSearch?: (query: string) => void;
  itemsLoading?: boolean;
}

/**
 * ⌘K command palette built on `cmdk`. Rendered as a centered overlay with a
 * search input and grouped list. Keyboard-only navigation (↑↓/Enter/Esc) is
 * provided by cmdk out of the box. The dialog has `label="Command palette"`
 * for screen readers.
 */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = "Search resources, actions…",
  onSearch,
  itemsLoading,
}: CommandPaletteProps) {
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="fixed inset-0 z-50 grid place-items-start pt-20 bg-black/40"
    >
      <div className="mx-auto w-[600px] max-w-[92vw] rounded-fp border border-fp-border-1 bg-fp-bg-1 shadow-2xl overflow-hidden">
        <Command.Input
          placeholder={placeholder}
          {...(onSearch ? { onValueChange: onSearch } : {})}
          className="w-full px-4 h-12 border-b border-fp-border-1 bg-transparent text-sm outline-none text-fp-text-1"
        />
        <Command.List className="max-h-[380px] overflow-y-auto p-2">
          {itemsLoading ? (
            <Command.Loading className="px-3 py-6 text-center text-sm text-fp-text-3">
              Loading…
            </Command.Loading>
          ) : null}
          <Command.Empty className="px-3 py-6 text-center text-sm text-fp-text-3">
            No results.
          </Command.Empty>
          {groups.map((g) => (
            <Command.Group key={g.label} heading={g.label}>
              {g.items.map((it) => (
                <Command.Item
                  key={`${g.label}:${it.label}`}
                  onSelect={it.onSelect}
                  {...(it.keywords ? { keywords: it.keywords } : {})}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm text-fp-text-1 aria-selected:bg-fp-bg-2 cursor-pointer"
                >
                  {it.icon}
                  <span>{it.label}</span>
                  {it.shortcut ? (
                    <kbd className="ml-auto text-xs text-fp-text-3">{it.shortcut}</kbd>
                  ) : null}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
