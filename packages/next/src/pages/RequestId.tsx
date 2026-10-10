"use client";
import { formatLabel } from "@flowpanel/core/labels";
import { useLabels } from "@flowpanel/react";
import { useEffect, useState } from "react";

/** A failure's ID as the server log names it, a request's or an error digest, with a button that copies it. */
export function RequestId({ id, kind = "request" }: { id: string; kind?: "request" | "digest" }) {
  const { errors } = useLabels();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <span className="fp-inline-flex fp-min-w-0 fp-items-center fp-gap-1 fp-text-xs fp-text-faint">
      <span className="fp-truncate fp-font-mono">
        {formatLabel(kind === "digest" ? errors.digest : errors.requestId, { id })}
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(id).then(
            () => setCopied(true),
            () => {},
          );
        }}
        className="fp-inline-flex fp-h-8 fp-shrink-0 fp-items-center fp-rounded-sm fp-px-2 fp-font-medium fp-text-soft hover:fp-bg-fill/70 hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
      >
        <span aria-live="polite">{copied ? errors.copied : errors.copyId}</span>
      </button>
    </span>
  );
}
