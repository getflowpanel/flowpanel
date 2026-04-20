"use client";

import type { ReactNode } from "react";

export interface ShellHeaderProps {
  right?: ReactNode;
}

/**
 * Top bar of the shell. Left side is reserved for a mobile nav spacer
 * (Sidebar renders its own mobile trigger). Right side holds controls
 * supplied by the page (time range, live status, command palette, theme toggle).
 */
export function ShellHeader({ right }: ShellHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6 lg:px-8">
      {/* Spacer to push sidebar's mobile menu button out of the way */}
      <div className="md:hidden h-9 w-9" aria-hidden="true" />
      <div className="flex flex-1 items-center justify-end gap-2">{right}</div>
    </header>
  );
}
