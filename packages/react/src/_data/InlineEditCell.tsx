"use client";
import { formatLabel } from "@flowpanel/core/labels";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { LocalTime } from "../_atoms/LocalTime";
import { useToast } from "../_feedback/toast-api";
import { useApiBase } from "../_provider/ApiBaseContext";
import { useLabels } from "../_provider/LabelsContext";
import { cn } from "../lib/cn";
import { humanize } from "../lib/humanize";

const PENCIL_REVEAL =
  "opacity-0 group-hover/row:opacity-100 group-hover/edit:opacity-100 group-focus-within/edit:opacity-100 [@media(hover:none)]:opacity-100";

/** Editable table cell. */
export interface InlineEditCellProps {
  resource: string;
  id: string;
  field: string;
  /** The column's label, for the edit button's accessible name. Defaults to the humanized field. */
  label?: string;
  value: unknown;
  valueType?: "string" | "number" | "boolean" | "date" | "enum" | "array" | "json" | "reference";
  /** Custom display formatter when not in edit mode. Defaults to `String(value)`. */
  display?: (v: unknown) => React.ReactNode;
  /** The row opens on click, so the cell text passes clicks through and editing starts from the pencil or Enter. */
  rowClickable?: boolean;
  className?: string;
}

export function InlineEditCell({
  resource,
  id,
  field,
  label,
  value,
  valueType,
  display,
  rowClickable = false,
  className,
}: InlineEditCellProps) {
  const router = useRouter();
  const toast = useToast();
  const apiBase = useApiBase();
  const labels = useLabels();
  const editLabel = formatLabel(labels.table.editCell, { label: label ?? humanize(field) });
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
      const res = await fetch(
        `${apiBase}/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/update`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ field, value: parsed }),
        },
      );
      const result = (await res.json()) as
        | { ok: true }
        | { ok: false; error: string; fieldErrors?: Record<string, string> };
      if (!result.ok) {
        toast.error(result.fieldErrors?.[field] || result.error || labels.formError);
        setDraft(original);
      } else {
        toast.success(labels.table.saved);
        router.refresh();
      }
    } catch {
      toast.error(labels.formError);
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
    const edit = (e: React.SyntheticEvent) => {
      e.stopPropagation();
      setEditing(true);
    };
    const editOnKey = (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      edit(e);
    };
    const shown = display ? display(value) : formatDisplay(value, valueType);
    if (rowClickable) {
      return (
        <span className="group/edit flex min-w-0 items-center gap-1">
          <span className={cn("min-w-0 flex-1 text-fp-text-1", className)}>{shown}</span>
          <button
            ref={triggerRef}
            type="button"
            onClick={edit}
            onKeyDown={editOnKey}
            aria-label={editLabel}
            className={cn(
              PENCIL_REVEAL,
              "shrink-0 rounded-fp-sm p-0.5 text-fp-text-3 transition-opacity hover:text-fp-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/60",
            )}
          >
            <Pencil size={14} aria-hidden />
          </button>
        </span>
      );
    }
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={edit}
        onKeyDown={editOnKey}
        aria-label={editLabel}
        className={cn(
          "group/edit flex w-full min-w-0 cursor-text items-center gap-1 rounded-fp-sm text-left text-fp-text-1 transition-colors hover:-mx-1 hover:-my-0.5 hover:bg-fp-bg-3/60 hover:px-1 hover:py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/60",
          className,
        )}
      >
        <span className="min-w-0 flex-1">{shown}</span>
        <Pencil
          size={14}
          aria-hidden
          className={cn(PENCIL_REVEAL, "shrink-0 text-fp-text-3 transition-opacity")}
        />
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
