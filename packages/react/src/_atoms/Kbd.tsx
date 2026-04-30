import type * as React from "react";

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-fp-sm border border-fp-border-1 bg-fp-bg-2 px-1.5 py-0.5 text-[11px] font-mono text-fp-text-2">
      {children}
    </kbd>
  );
}
