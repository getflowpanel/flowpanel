"use client";
import { useApiBase, useLabels } from "@flowpanel/react";
import * as React from "react";

export interface AuditFullValueProps {
  eventId: string;
  field: string;
  side: "before" | "after";
  /** The start of the value, as the feed received it. */
  text: string;
  /** Beside the button, such as the length that tells two values with the same start apart. */
  note?: string;
  /** Names the expanded value for screen readers, such as "Notes, after". */
  name?: string;
}

/** Rows that show a value whole up to a screenful; a longer one scrolls in its own box. */
const rowsFor = (value: string): number =>
  Math.min(16, Math.max(2, value.split("\n").length + Math.ceil(value.length / 120)));

type State =
  | { kind: "preview" }
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "full"; value: string };

/** A long audit value: its start with "Show full value", which fetches the rest and expands in place. */
export function AuditFullValue({ eventId, field, side, text, note, name }: AuditFullValueProps) {
  const apiBase = useApiBase();
  const labels = useLabels().audit;
  const [state, setState] = React.useState<State>({ kind: "preview" });
  const loaded = React.useRef<string | null>(null);

  async function expand(): Promise<void> {
    if (state.kind === "loading") return;
    if (loaded.current !== null) {
      setState({ kind: "full", value: loaded.current });
      return;
    }
    setState({ kind: "loading" });
    const query = new URLSearchParams({ field, side });
    try {
      const response = await fetch(
        `${apiBase}/audit/${encodeURIComponent(eventId)}/value?${query}`,
      );
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "ok" in body &&
        body.ok === true &&
        "value" in body &&
        typeof body.value === "string"
      ) {
        loaded.current = body.value;
        setState({ kind: "full", value: body.value });
        return;
      }
    } catch {}
    setState({ kind: "failed" });
  }

  const full = state.kind === "full";
  return (
    <span className="fp-block fp-min-w-0">
      {full ? (
        <textarea
          readOnly
          value={state.value}
          rows={rowsFor(state.value)}
          aria-label={name ?? labels.showFullValue}
          className="fp-block fp-w-full fp-resize-y fp-rounded fp-border fp-border-line fp-bg-canvas fp-px-2 fp-py-1.5 fp-text-sm fp-text-ink fp-wrap-anywhere focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
        />
      ) : (
        <span className="fp-wrap-anywhere">{`${text}…`}</span>
      )}
      <span className="fp-mt-0.5 fp-flex fp-flex-wrap fp-items-center fp-gap-x-3">
        <button
          type="button"
          className="fp-inline-flex fp-min-h-6 fp-items-center fp-rounded-sm fp-text-xs fp-font-medium fp-text-soft fp-underline fp-decoration-line fp-underline-offset-4 hover:fp-text-ink hover:fp-decoration-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 aria-busy:fp-cursor-progress"
          aria-busy={state.kind === "loading" || undefined}
          aria-expanded={full}
          onClick={() => (full ? setState({ kind: "preview" }) : void expand())}
        >
          {full ? labels.showLess : labels.showFullValue}
        </button>
        {note ? <span className="fp-text-xs fp-text-faint">{note}</span> : null}
        <span role="status" className="fp-text-xs fp-text-err empty:fp-hidden">
          {state.kind === "failed" ? labels.fullValueFailed : null}
        </span>
      </span>
    </span>
  );
}
