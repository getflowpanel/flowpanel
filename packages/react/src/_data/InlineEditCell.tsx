"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { LocalTime } from "../_atoms/LocalTime.js";
import { useToast } from "../_feedback/Toast.js";
import { cn } from "../lib/cn.js";

/**
 * Editable table cell. Renders the value as plain text by default;
 * double-clicking swaps the cell into an input bound to local state.
 *
 * - **Enter / blur** — POST `/api/flowpanel/<resource>/<id>/update` with
 *   `{ field, value }`. On success: optimistic value sticks until the
 *   next `router.refresh()` lands the server value. On failure: revert
 *   to the original value, surface the error as a toast.
 * - **Esc** — cancel, revert to original.
 *
 * The input type is inferred from `valueType`:
 *
 * - `"number"` → `<input type="number">` parsed as a number
 * - `"date"` → `<input type="datetime-local">` parsed via `Date(value)`
 * - Default → plain text input
 *
 * Enum-typed columns fall back to plain text in this v1; rendering a
 * `<Select>` requires the column to also carry its option list, which
 * lands alongside per-column metadata propagation in Phase 1.x.
 */
export interface InlineEditCellProps {
  resource: string;
  id: string;
  field: string;
  value: unknown;
  valueType?: "string" | "number" | "boolean" | "date" | "enum" | "array" | "json" | "reference";
  /** Custom display formatter when not in edit mode. Defaults to `String(value)`. */
  display?: (v: unknown) => React.ReactNode;
  className?: string;
}

export function InlineEditCell({
  resource,
  id,
  field,
  value,
  valueType,
  display,
  className,
}: InlineEditCellProps) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(() => valueToInputString(value, valueType));
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync draft if the server value changes while we're idle.
  React.useEffect(() => {
    if (!editing) setDraft(valueToInputString(value, valueType));
  }, [value, valueType, editing]);

  // Focus the input when the cell enters edit mode (replaces autoFocus,
  // which the a11y lint forbids). The input only mounts while editing, so
  // this fires on every edit activation.
  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    // Guard against double-fire: pressing Enter sets `pending`, which
    // disables the focused input, triggering a native blur → `onBlur={save}`.
    // Without this the cell would POST twice for a single edit.
    if (pending) return;
    const parsed = inputStringToValue(draft, valueType);
    const original = valueToInputString(value, valueType);
    if (draft === original) {
      setEditing(false);
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/flowpanel/${resource}/${id}/update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field, value: parsed }),
      });
      const result = (await res.json()) as { ok: true } | { ok: false; error: string };
      if (!result.ok) {
        toast.error(result.error || "Update failed");
        setDraft(original);
      } else {
        toast.success("Saved");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      setDraft(original);
    } finally {
      setPending(false);
      setEditing(false);
    }
  }

  function cancel() {
    setDraft(valueToInputString(value, valueType));
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onDoubleClick={() => setEditing(true)}
        // Single-click ignored — that's reserved for row-click handlers.
        // Double-click matches the spreadsheet convention.
        className={cn(
          "w-full cursor-text text-left text-fp-text-1 hover:bg-fp-bg-2 hover:px-1 hover:py-0.5 hover:-mx-1 hover:-my-0.5 rounded-fp-sm",
          className,
        )}
        aria-label={`Double-click to edit ${field}`}
      >
        {display ? display(value) : formatDisplay(value, valueType)}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type={inputTypeFor(valueType)}
      value={draft}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void save();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
        // Stop event so DataTable's j/k/Enter handlers don't interfere.
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "w-full rounded-fp-sm border border-fp-border-2 bg-fp-bg-1 px-1.5 py-0.5 text-fp-text-1 focus:border-fp-accent focus:outline-none",
        className,
      )}
    />
  );
}

function inputTypeFor(t: InlineEditCellProps["valueType"]): React.HTMLInputTypeAttribute {
  switch (t) {
    case "number":
      return "number";
    case "date":
      return "datetime-local";
    default:
      return "text";
  }
}

function valueToInputString(v: unknown, t: InlineEditCellProps["valueType"]): string {
  if (v === null || v === undefined) return "";
  if (t === "date") {
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    // A `datetime-local` input shows and emits wall-clock time in the VIEWER's
    // zone, so seed it with LOCAL date/time components — not `toISOString()`,
    // which would shift the displayed value by the UTC offset and let a no-op
    // edit silently rewrite the instant. `new Date(localString)` on save then
    // re-interprets these components in the same local zone (see
    // `inputStringToValue`), making the round-trip lossless.
    return localDateTimeString(d);
  }
  return String(v);
}

/** Format a `Date` as `YYYY-MM-DDTHH:mm` in the local zone for a `datetime-local` input. */
function localDateTimeString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function inputStringToValue(draft: string, t: InlineEditCellProps["valueType"]): unknown {
  if (draft === "") return null;
  if (t === "number") {
    const n = Number(draft);
    return Number.isFinite(n) ? n : draft;
  }
  if (t === "date") {
    const d = new Date(draft);
    return Number.isNaN(d.getTime()) ? draft : d.toISOString();
  }
  return draft;
}

function formatDisplay(v: unknown, t: InlineEditCellProps["valueType"]): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-fp-text-3">—</span>;
  if (t === "date") {
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      // Render through `LocalTime` so the read-only display of an editable
      // date matches the viewer-timezone formatting used by non-editable date
      // cells (`renderCellValue` → `LocalTime`). `LocalTime` is SSR-safe: it
      // formats in `fallbackTimeZone` until mount, then flips to the viewer's
      // own zone, so an inline-editable date never diverges from the rest of
      // the table.
      return <LocalTime date={d} />;
    }
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
