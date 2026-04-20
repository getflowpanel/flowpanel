import type { SerializedColumn } from "@flowpanel/core";
import { TextCell } from "./TextCell";
import { BadgeCell } from "./BadgeCell";
import { MoneyCell } from "./MoneyCell";
import { DateCell } from "./DateCell";
import { BooleanCell } from "./BooleanCell";
import { ImageCell } from "./ImageCell";
import { JsonCell } from "./JsonCell";
import { NumberCell } from "./NumberCell";

export function CellRenderer({
  column,
  value,
  row,
}: {
  column: SerializedColumn;
  value: unknown;
  row: Record<string, unknown>;
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Resolve format: use explicit format, or auto-detect
  const format = column.format === "auto" ? autoDetectFormat(column, value) : column.format;

  switch (format) {
    case "enum":
      return <BadgeCell value={value} />;
    case "money":
      return <MoneyCell value={value} />;
    case "relative":
      return <DateCell value={value} format="relative" />;
    case "absolute":
    case "calendar":
      return <DateCell value={value} format="absolute" />;
    case "boolean":
      return <BooleanCell value={value} />;
    case "image":
      return <ImageCell value={value} />;
    case "json":
      return <JsonCell value={value} />;
    case "number":
    case "percent":
      return <NumberCell value={value} />;
    default:
      return <TextCell value={value} mono={column.opts?.mono} />;
  }
}

function autoDetectFormat(column: SerializedColumn, value: unknown): string {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (value instanceof Date || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)))
    return "relative";
  if (typeof value === "object") return "json";
  return "text";
}

export { TextCell, BadgeCell, MoneyCell, DateCell, BooleanCell, ImageCell, JsonCell, NumberCell };
