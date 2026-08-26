"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { LocalTime } from "../_atoms/LocalTime";
import { useToast } from "../_feedback/toast-api";
import { useApiBase } from "../_provider/ApiBaseContext";
import { cn } from "../lib/cn";

/** Editable table cell. */
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
  const apiBase = useApiBase();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(() => valueToInputString(value, valueType));
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const wasEditing = React.useRef(false);

  React.useEffect(() => {
    if (!editing) setDraft(valueToInputString(value, valueType));
  }, [value, valueType, editing]);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (wasEditing.current) triggerRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  async function save() {
    if (pending) return;
    const parsed = inputStringToValue(draft, valueType);
    const original = valueToInputString(value, valueType);
    if (draft === original) {
      setEditing(false);
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`${apiBase}/${resource}/${id}/update`, {
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
        ref={triggerRef}
        type="button"
        onDoubleClick={() => setEditing(true)}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setEditing(true);
          }
        }}
        className={cn(
          "w-full cursor-text rounded-fp-sm text-left text-fp-text-1 transition-colors hover:-mx-1 hover:-my-0.5 hover:bg-fp-bg-3/60 hover:px-1 hover:py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40",
          className,
        )}
        aria-label={`Edit ${field}`}
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
      return <LocalTime date={d} />;
    }
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
