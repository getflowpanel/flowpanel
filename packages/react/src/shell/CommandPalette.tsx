"use client";
import type * as React from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import { ChunkBoundary } from "../lib/chunk-boundary";
import { lazyRetry } from "../lib/lazy-retry";
import { useLabels } from "../provider/LabelsContext";

export interface CommandGroupUI {
  label: string;
  items: Array<{
    label: string;
    onSelect: () => void;
    icon?: React.ReactNode;
    shortcut?: string;
    keywords?: string[];
    /** A muted second part, such as a found record's email. */
    detail?: string;
    /** Tells apart items whose labels repeat; defaults to the label. */
    value?: string;
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

const CommandPaletteDialog = lazyRetry<CommandPaletteProps>(() =>
  import("./CommandPaletteDialog").then((module) => ({ default: module.CommandPaletteDialog })),
);

/** The palette's frame while its code loads: it takes the focus, so keys stop reaching the page, and Escape closes it. */
function PaletteShell({ onOpenChange }: Pick<CommandPaletteProps, "onOpenChange">) {
  const { palette } = useLabels();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <div className="fp-fixed fp-inset-0 fp-z-50 fp-bg-overlay/60">
      <div
        role="dialog"
        aria-label={palette.title}
        aria-busy="true"
        className="fp-fixed fp-left-1/2 fp-top-20 fp-w-[600px] fp-max-w-[92vw] -fp-translate-x-1/2 fp-rounded-xl fp-border fp-border-line fp-bg-surface fp-shadow-lg"
      >
        <input
          ref={input}
          readOnly
          aria-label={palette.title}
          placeholder={palette.loading}
          onKeyDown={(event) => {
            if (event.key === "Escape") onOpenChange(false);
          }}
          className="fp-h-12 fp-w-full fp-bg-transparent fp-px-4 fp-text-sm fp-outline-none placeholder:fp-text-faint"
        />
      </div>
    </div>
  );
}

/** ⌘K command palette; it and `cmdk` load the first time it opens, not with every page. */
export function CommandPalette(props: CommandPaletteProps) {
  const [opened, setOpened] = useState(props.open);
  if (props.open && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <ChunkBoundary floating>
      <Suspense fallback={props.open ? <PaletteShell onOpenChange={props.onOpenChange} /> : null}>
        <CommandPaletteDialog {...props} />
      </Suspense>
    </ChunkBoundary>
  );
}
