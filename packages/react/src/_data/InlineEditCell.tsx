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
  "fp-opacity-0 group-hover/row:fp-opacity-100 group-hover/edit:fp-opacity-100 group-focus-within/edit:fp-opacity-100 [@media(hover:none)]:fp-opacity-100";

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
        <span className="fp-group/edit fp-flex fp-min-w-0 fp-items-center fp-gap-1">
          <span className={cn("fp-min-w-0 fp-flex-1 fp-text-ink", className)}>{shown}</span>
          <button
            ref={triggerRef}
            type="button"
            onClick={edit}
            onKeyDown={editOnKey}
            aria-label={editLabel}
            className={cn(
              PENCIL_REVEAL,
              "fp-shrink-0 fp-rounded-sm fp-p-0.5 fp-text-faint fp-transition-opacity hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
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
          "fp-group/edit fp-flex fp-w-full fp-min-w-0 fp-cursor-text fp-items-center fp-gap-1 fp-rounded-sm fp-text-left fp-text-ink fp-transition-colors hover:-fp-mx-1 hover:-fp-my-0.5 hover:fp-bg-fill/60 hover:fp-px-1 hover:fp-py-0.5 focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
          className,
        )}
      >
        <span className="fp-min-w-0 fp-flex-1">{shown}</span>
        <Pencil
          size={14}
          aria-hidden
          className={cn(PENCIL_REVEAL, "fp-shrink-0 fp-text-faint fp-transition-opacity")}
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
        "fp-w-full fp-rounded-sm fp-border fp-border-line-strong fp-bg-surface fp-px-1.5 fp-py-0.5 fp-text-ink focus:fp-border-accent focus:fp-outline-none",
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
  if (v === null || v === undefined) return <span className="fp-text-faint">—</span>;
  if (t === "date") {
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      return <LocalTime date={d} />;
    }
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
