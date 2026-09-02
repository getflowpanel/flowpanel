import type { ReactNode } from "react";

/**
 * Inline code pill for marketing prose (e.g. `/admin`, `localhost:3000`).
 * Single-sources the look that was otherwise duplicated per landing section.
 * For multi-line terminal/code blocks use `CodeBlock` instead.
 */
export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-fg)]">
      {children}
    </code>
  );
}
