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

/** ⌘K command palette built on `cmdk`. */
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
      className="fp-anim-overlay fixed inset-0 z-50 grid place-items-start bg-fp-overlay/60 pt-20 backdrop-blur-[2px]"
    >
      <div className="mx-auto w-[600px] max-w-[92vw] overflow-hidden rounded-fp-xl border border-fp-border-1 bg-fp-bg-1 shadow-fp-lg">
        <Command.Input
          placeholder={placeholder}
          {...(onSearch ? { onValueChange: onSearch } : {})}
          className="h-12 w-full border-b border-fp-border-1 bg-transparent px-4 text-sm text-fp-text-1 outline-none placeholder:text-fp-text-3"
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
                  className="flex cursor-pointer items-center gap-2 rounded-fp px-3 py-2 text-sm text-fp-text-1 aria-selected:bg-fp-bg-3/70"
                >
                  {it.icon}
                  <span>{it.label}</span>
                  {it.shortcut ? (
                    <kbd className="ml-auto rounded-fp-sm border border-fp-border-1 bg-fp-bg-2 px-1.5 py-0.5 font-fp-mono text-[10px] text-fp-text-3">
                      {it.shortcut}
                    </kbd>
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
