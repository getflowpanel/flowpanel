import type { ReactNode } from "react";

interface CodeBlockProps {
  children: ReactNode;
  className?: string;
}

/**
 * Static code presentation block.
 *
 * Renders a soft, low-contrast surface for terminal commands and short
 * inline-style snippets — the same look used across the landing for the
 * "$ pnpm flowpanel init" lines and the per-layer config examples.
 *
 * For MDX-driven prose, use the Fumadocs code block (handles syntax
 * highlighting); this primitive is the marketing/landing surface.
 */
export function CodeBlock({ children, className }: CodeBlockProps) {
  return (
    <pre
      className={[
        "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3 font-mono text-sm leading-6 text-[var(--color-fg)] whitespace-pre-wrap",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </pre>
  );
}

interface PromptLineProps {
  command: string;
}

/** A single `$ ...` prompt line — convenience for the most common case. */
export function PromptLine({ command }: PromptLineProps) {
  return (
    <>
      <span className="select-none text-[var(--color-fg-subtle)]">$</span> {command}
    </>
  );
}

interface OutputLineProps {
  text: string;
}

/** A "→ ..." program output line, lower-contrast than a prompt. */
export function OutputLine({ text }: OutputLineProps) {
  return (
    <span className="text-[var(--color-fg-muted)]">
      <span aria-hidden>→</span> {text}
    </span>
  );
}
