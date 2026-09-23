"use client";
import { formatCount } from "@flowpanel/core/labels";
import { useFormatting } from "../_provider/FormattingContext";
import { useLabels } from "../_provider/LabelsContext";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";

export interface BulkBarAction {
  key: string;
  label: string;
  variant?: "default" | "destructive";
  onClick: (ids: string[]) => void | Promise<void>;
  disabled?: boolean;
}

export interface BulkBarProps {
  selection: string[];
  actions: BulkBarAction[];
  onClear: () => void;
}

export function BulkBar({ selection, actions, onClear }: BulkBarProps) {
  const labels = useLabels();
  const { locale } = useFormatting();
  if (selection.length === 0) return null;
  const count = formatCount(
    labels.plurals?.selected ?? labels.bulkBar.selected,
    selection.length,
    locale,
  );
  return (
    <section
      data-state={selection.length > 0 ? "open" : "closed"}
      aria-label={count}
      className={cn(
        "fp-bulkbar",
        "sticky bottom-4 z-30 mx-auto mt-3 flex w-fit items-center gap-3 rounded-fp-lg border border-fp-border-1 bg-fp-bg-1 py-2 pl-4 pr-2 shadow-fp-lg",
      )}
    >
      <span className="text-sm font-medium tabular-nums text-fp-text-1">{count}</span>
      <span aria-hidden className="h-5 w-px bg-fp-border-1" />
      {actions.map((a) => (
        <Button
          key={a.key}
          size="sm"
          variant={a.variant === "destructive" ? "destructive" : "default"}
          disabled={a.disabled}
          onClick={() => void a.onClick(selection)}
        >
          {a.label}
        </Button>
      ))}
      <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear selection">
        {labels.bulkBar.clear}
      </Button>
    </section>
  );
}
