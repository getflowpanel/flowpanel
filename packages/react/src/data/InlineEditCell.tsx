"use client";
import { failureMessage, formatLabel, type ResolvedLabels } from "@flowpanel/core/labels";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { LocalTime } from "../atoms/LocalTime";
import { useToast } from "../feedback/toast-api";
import { cn } from "../lib/cn";
import { connectionMessage } from "../lib/connection-message";
import { humanize } from "../lib/humanize";
import { isReply, readReply, textOf } from "../lib/json-reply";
import { useApiBase } from "../provider/ApiBaseContext";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { BooleanCell } from "./FormatCells";
import { editorClass, InlineEditSelect } from "./InlineEditSelect";
import {
  type CellValueType,
  type EditKind,
  inputStringToValue,
  inputTypeFor,
  valueToInputString,
} from "./inline-edit-values";

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
  valueType?: CellValueType;
  /** A SQL `date` column: edited as a calendar day, with no time and no zone. */
  calendarDay?: boolean;
  /** The choices to pick from, which turn the editor into a select; a yes/no column gets its own. */
  options?: ReadonlyArray<{ value: string; label: string }>;
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
  calendarDay,
  options,
  display,
  rowClickable = false,
  className,
}: InlineEditCellProps) {
  const router = useRouter();
  const toast = useToast();
  const apiBase = useApiBase();
  const labels = useLabels();
  const { timeZone } = useFormatting();
  const kind: EditKind = calendarDay && valueType === "date" ? "day" : valueType;
  const editLabel = formatLabel(labels.table.editCell, { label: label ?? humanize(field) });
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(() => valueToInputString(value, kind, timeZone));
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selectRef = React.useRef<HTMLSelectElement>(null);
  const choices =
    options ??
    (valueType === "boolean"
      ? [
          { value: "true", label: labels.filters.yes },
          { value: "false", label: labels.filters.no },
        ]
      : undefined);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const wasEditing = React.useRef(false);
  const open = React.useRef(false);

  React.useEffect(() => {
    if (editing) (selectRef.current ?? inputRef.current)?.focus();
    else if (wasEditing.current) triggerRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  async function save(next = draft) {
    if (!open.current) return;
    open.current = false;
    const parsed = inputStringToValue(next, kind);
    const original = valueToInputString(value, kind, timeZone);
    if (next === original) {
      setEditing(false);
      return;
    }
    setPending(true);
    const failure = await sendEdit(
      `${apiBase}/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/update`,
      field,
      parsed,
      labels,
    );
    if (failure === null) {
      toast.success(labels.table.saved);
      router.refresh();
    } else {
      toast.error(failure);
      setDraft(original);
    }
    setPending(false);
    setEditing(false);
  }

  function cancel() {
    open.current = false;
    setDraft(valueToInputString(value, kind, timeZone));
    setEditing(false);
  }

  if (!editing) {
    const edit = (e: React.SyntheticEvent) => {
      e.stopPropagation();
      setDraft(valueToInputString(value, kind, timeZone));
      open.current = true;
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
          <span className={cn("fp-min-w-0 fp-flex-1 fp-truncate fp-text-ink", className)}>
            {shown}
          </span>
          <button
            ref={triggerRef}
            type="button"
            onClick={edit}
            onKeyDown={editOnKey}
            aria-label={editLabel}
            className={cn(
              PENCIL_REVEAL,
              "fp-relative -fp-my-1 fp-inline-flex fp-h-6 fp-w-6 fp-shrink-0 fp-items-center fp-justify-center fp-rounded-sm fp-text-faint fp-transition-opacity after:fp-absolute after:-fp-inset-2 after:fp-content-[''] hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
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
        className={cn(
          "fp-group/edit fp-relative fp-flex fp-w-full fp-min-w-0 fp-cursor-text fp-items-center fp-gap-1 fp-rounded-sm fp-text-left fp-text-ink fp-transition-colors hover:-fp-mx-1 hover:-fp-my-0.5 hover:fp-bg-fill/60 hover:fp-px-1 hover:fp-py-0.5 focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
          className,
        )}
      >
        <span className="fp-min-w-0 fp-flex-1 fp-truncate">{shown}</span>
        <span className="fp-sr-only">{editLabel}</span>
        <Pencil
          size={14}
          aria-hidden
          className={cn(PENCIL_REVEAL, "fp-shrink-0 fp-text-faint fp-transition-opacity")}
        />
      </button>
    );
  }

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
    e.stopPropagation();
  };
  if (choices) {
    return (
      <InlineEditSelect
        ref={selectRef}
        label={label ?? humanize(field)}
        current={valueToInputString(value, kind, timeZone)}
        choices={choices}
        draft={draft}
        disabled={pending}
        onDraft={setDraft}
        onPick={(next) => void save(next)}
        onLeave={() => void save()}
        onKeyDown={keys}
        {...(className ? { className } : {})}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      aria-label={label ?? humanize(field)}
      type={inputTypeFor(kind)}
      value={draft}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={keys}
      onClick={(e) => e.stopPropagation()}
      className={editorClass(className)}
    />
  );
}

/** Sends one cell's new value; answers the message to show when it did not save, else `null`. */
async function sendEdit(
  url: string,
  field: string,
  value: unknown,
  labels: ResolvedLabels,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field, value }),
    });
  } catch {
    return connectionMessage(labels.errors);
  }
  const result = await readReply(response);
  if (response.ok && result.ok === true) return null;
  const fieldError = isReply(result.fieldErrors) ? textOf(result.fieldErrors[field]) : undefined;
  return (
    fieldError ??
    failureMessage(labels.errors, result.code, textOf(result.error)) ??
    labels.form.error
  );
}

function formatDisplay(v: unknown, t: InlineEditCellProps["valueType"]): React.ReactNode {
  if (v === null || v === undefined) return <span className="fp-text-faint">—</span>;
  if (t === "date") {
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      return <LocalTime date={d} />;
    }
  }
  if (typeof v === "boolean") return <BooleanCell value={v} />;
  return String(v);
}
