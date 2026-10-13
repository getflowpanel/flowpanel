"use client";
import { formatCount } from "@flowpanel/core/labels";
import { cn } from "../lib/cn";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
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
        "fp-sticky fp-bottom-4 fp-z-30 fp-mx-auto fp-mt-3 fp-flex fp-w-fit fp-items-center fp-gap-3 fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-py-2 fp-pl-4 fp-pr-2 fp-shadow-lg",
      )}
    >
      <span className="fp-text-sm fp-font-medium fp-tabular-nums fp-text-ink">{count}</span>
      <span aria-hidden className="fp-h-5 fp-w-px fp-bg-line" />
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
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        aria-label={labels.bulkBar.clearSelection}
      >
        {labels.bulkBar.clear}
      </Button>
    </section>
  );
}
