"use client";
import { useLabels } from "../_provider/LabelsContext.js";
import { Button } from "../ui/button.js";

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
  if (selection.length === 0) return null;
  return (
    <div
      role="region"
      aria-label={labels.bulkBar.selected(selection.length)}
      className="sticky bottom-4 z-30 mx-auto mt-3 flex w-fit items-center gap-3 rounded-fp border border-fp-border-1 bg-fp-bg-1 px-3 py-2 shadow-lg"
    >
      <span className="text-sm text-fp-text-2">{labels.bulkBar.selected(selection.length)}</span>
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
    </div>
  );
}
