import { formatDistanceToNow, format as dateFnsFormat } from "date-fns";

export function DateCell({
  value,
  format: fmt,
}: {
  value: unknown;
  format: "relative" | "absolute";
}) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return <span className="text-muted-foreground">—</span>;

  if (fmt === "relative") {
    return (
      <span className="text-muted-foreground text-sm" title={date.toISOString()}>
        {formatDistanceToNow(date, { addSuffix: true })}
      </span>
    );
  }
  return <span className="text-sm">{dateFnsFormat(date, "MMM d, yyyy HH:mm")}</span>;
}
