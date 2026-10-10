"use client";
import { Command } from "cmdk";
import type * as React from "react";
import { useLabels } from "../_provider/LabelsContext";
import { DialogDescription, DialogTitle } from "../ui/dialog";

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
  placeholder,
  onSearch,
  itemsLoading,
}: CommandPaletteProps) {
  const { palette } = useLabels();
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={palette.title}
      className="fp-anim-overlay fp-fixed fp-inset-0 fp-z-50 fp-grid fp-place-items-start fp-bg-overlay/60 fp-pt-20 fp-backdrop-blur-[2px]"
    >
      <DialogTitle className="fp-sr-only">{palette.title}</DialogTitle>
      <DialogDescription className="fp-sr-only">{palette.description}</DialogDescription>
      <div className="fp-mx-auto fp-w-[600px] fp-max-w-[92vw] fp-overflow-hidden fp-rounded-xl fp-border fp-border-line fp-bg-surface fp-shadow-lg">
        <Command.Input
          placeholder={placeholder ?? palette.placeholder}
          {...(onSearch ? { onValueChange: onSearch } : {})}
          className="fp-h-12 fp-w-full fp-border-b fp-border-line fp-bg-transparent fp-px-4 fp-text-sm fp-text-ink fp-outline-none placeholder:fp-text-faint"
        />
        <Command.List className="fp-max-h-[380px] fp-overflow-y-auto fp-p-2">
          {itemsLoading ? (
            <Command.Loading className="fp-px-3 fp-py-6 fp-text-center fp-text-sm fp-text-faint">
              {palette.loading}
            </Command.Loading>
          ) : null}
          <Command.Empty className="fp-px-3 fp-py-6 fp-text-center fp-text-sm fp-text-faint">
            {palette.noResults}
          </Command.Empty>
          {groups.map((g) => (
            <Command.Group key={g.label} heading={g.label}>
              {g.items.map((it) => (
                <Command.Item
                  key={`${g.label}:${it.label}`}
                  onSelect={it.onSelect}
                  {...(it.keywords ? { keywords: it.keywords } : {})}
                  className="fp-flex fp-cursor-pointer fp-items-center fp-gap-2 fp-rounded fp-px-3 fp-py-2 fp-text-sm fp-text-ink aria-selected:fp-bg-fill/70"
                >
                  {it.icon}
                  <span>{it.label}</span>
                  {it.shortcut ? (
                    <kbd className="fp-ml-auto fp-rounded-sm fp-border fp-border-line fp-bg-canvas fp-px-1.5 fp-py-0.5 fp-font-mono fp-text-[10px] fp-text-faint">
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
