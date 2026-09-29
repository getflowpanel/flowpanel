import type { ReactNode } from "react";

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-fg)]">
      {children}
    </code>
  );
}
