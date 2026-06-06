"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CopyButtonProps {
  /** The exact text written to the clipboard. */
  text: string;
  /** Visible label next to the icon. */
  label?: string;
}

/**
 * Copies `text` to the clipboard and shows a brief "Copied" confirmation.
 * Client island — the only interactive part of the otherwise-static hero.
 */
export function CopyButton({ text, label = "copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      aria-label={copied ? "Copied to clipboard" : `Copy "${text}" to clipboard`}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
    >
      {copied ? (
        <Check aria-hidden className="h-3.5 w-3.5 text-[var(--color-accent)]" />
      ) : (
        <Copy aria-hidden className="h-3.5 w-3.5" />
      )}
      <span>{copied ? "copied" : label}</span>
    </button>
  );
}
