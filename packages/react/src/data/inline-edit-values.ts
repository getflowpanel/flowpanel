import { formatDateTime } from "@flowpanel/core/format";
import type * as React from "react";

/** A column's normalized type, as `ColumnMeta.type` names it. */
export type CellValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "array"
  | "json"
  | "reference";

/** What the editor edits: a column's value type, or `day` for a SQL `date` column. */
export type EditKind = CellValueType | "day" | undefined;

const WALL_TIME: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

export function inputTypeFor(kind: EditKind): React.HTMLInputTypeAttribute {
  if (kind === "number") return "number";
  if (kind === "date") return "datetime-local";
  return kind === "day" ? "date" : "text";
}

/** A timestamp as `YYYY-MM-DDTHH:mm` on the admin's clock, which the server reads back on it; a calendar day as its `YYYY-MM-DD`. */
export function valueToInputString(v: unknown, kind: EditKind, timeZone: string): string {
  if (v === null || v === undefined) return "";
  if (kind !== "date" && kind !== "day") return String(v);
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  if (kind === "day") return d.toISOString().slice(0, 10);
  return formatDateTime(d, "en-CA", { ...WALL_TIME, timeZone }, "T");
}

export function inputStringToValue(draft: string, kind: EditKind): unknown {
  if (draft === "") return null;
  if (kind === "boolean") return draft === "true";
  if (kind === "number") {
    const n = Number(draft);
    return Number.isFinite(n) ? n : draft;
  }
  return draft;
}
