"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useLabels } from "../provider/LabelsContext";
import type { CommandPaletteProps } from "./CommandPalette";
import { paletteScore } from "./palette-score";

/** The palette itself, built on `cmdk`; `CommandPalette` loads it the first time it opens. */
export function CommandPaletteDialog({
  open,
  onOpenChange,
  groups,
  placeholder,
  onSearch,
  itemsLoading,
}: CommandPaletteProps) {
  const { palette } = useLabels();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-flowpanel-portal=""
          className="fp-anim-overlay fp-fixed fp-inset-0 fp-z-50 fp-bg-overlay/60 fp-backdrop-blur-[2px]"
        />
        <DialogPrimitive.Content
          data-flowpanel-portal=""
          className="fp-anim-dialog fp-fixed fp-left-1/2 fp-top-20 fp-z-50 fp-w-[600px] fp-max-w-[92vw] -fp-translate-x-1/2 fp-overflow-hidden fp-rounded-xl fp-border fp-border-line fp-bg-surface fp-shadow-lg focus:fp-outline-none"
        >
          <DialogPrimitive.Title className="fp-sr-only">{palette.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="fp-sr-only">
            {palette.description}
          </DialogPrimitive.Description>
          <Command label={palette.title} filter={paletteScore}>
            <Command.Input
              placeholder={placeholder ?? palette.placeholder}
              {...(onSearch ? { onValueChange: onSearch } : {})}
              className="fp-h-12 fp-w-full fp-border-b fp-border-line fp-bg-transparent fp-px-4 fp-text-sm fp-text-ink fp-outline-none placeholder:fp-text-faint"
            />
            <Command.List
              label={palette.suggestions}
              className="fp-max-h-[380px] fp-overflow-y-auto fp-p-2"
            >
              {itemsLoading ? (
                <Command.Loading className="fp-px-3 fp-py-6 fp-text-center fp-text-sm fp-text-faint">
                  {palette.loading}
                </Command.Loading>
              ) : null}
              {itemsLoading ? null : (
                <Command.Empty className="fp-px-3 fp-py-6 fp-text-center fp-text-sm fp-text-faint">
                  {palette.noResults}
                </Command.Empty>
              )}
              {groups.map((g) => (
                <Command.Group
                  key={g.label}
                  heading={g.label}
                  className="[&_[cmdk-group-heading]]:fp-px-3 [&_[cmdk-group-heading]]:fp-pb-1 [&_[cmdk-group-heading]]:fp-pt-2 [&_[cmdk-group-heading]]:fp-text-xs [&_[cmdk-group-heading]]:fp-font-medium [&_[cmdk-group-heading]]:fp-text-faint"
                >
                  {g.items.map((it) => (
                    <Command.Item
                      key={`${g.label}:${it.value ?? it.label}`}
                      value={it.value ?? it.label}
                      onSelect={it.onSelect}
                      keywords={[
                        it.label,
                        ...(it.detail ? [it.detail] : []),
                        ...(it.keywords ?? []),
                      ]}
                      className="fp-flex fp-cursor-pointer fp-items-center fp-gap-2 fp-rounded fp-px-3 fp-py-2 fp-text-sm fp-text-ink aria-selected:fp-bg-fill/70"
                    >
                      {it.icon}
                      <span className="fp-min-w-0 fp-truncate">{it.label}</span>
                      {it.detail ? (
                        <span className="fp-min-w-0 fp-truncate fp-text-faint">{it.detail}</span>
                      ) : null}
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
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
