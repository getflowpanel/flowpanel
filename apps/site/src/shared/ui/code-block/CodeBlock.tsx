import type { ReactNode } from "react";

interface CodeBlockProps {
  children: ReactNode;
  className?: string;
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  return (
    <pre
      className={[
        "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3 font-mono text-sm leading-6 text-[var(--color-fg)] whitespace-pre-wrap break-words",
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
      <span aria-hidden>→</span>
      {"\u00a0"}
      {text}
    </span>
  );
}
