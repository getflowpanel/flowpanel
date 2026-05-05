"use client";
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
  if (selection.length === 0) return null;
  return (
    <div
      role="region"
      aria-label={`${selection.length} items selected`}
      className="sticky bottom-4 z-30 mx-auto mt-3 flex w-fit items-center gap-3 rounded-fp border border-fp-border-1 bg-fp-bg-1 px-3 py-2 shadow-lg"
    >
      <span className="text-sm text-fp-text-2">{selection.length} selected</span>
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
        Clear
      </Button>
    </div>
  );
}
