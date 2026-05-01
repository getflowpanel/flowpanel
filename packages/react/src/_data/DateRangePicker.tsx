"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { DateRangePreset } from "@flowpanel/core";
import { cn } from "../lib/cn.js";

// NOTE: Custom calendar range selection is deferred to M4 polish; for M2 the
// 7 presets cover the spec's dashboard examples.

export interface DateRangePickerProps {
  value: { preset?: DateRangePreset; from?: Date; to?: Date };
  onChange: (next: { preset?: DateRangePreset; from?: Date; to?: Date }) => void;
  allowCustom?: boolean;
}

const PRESETS: Array<{ key: DateRangePreset; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7d", label: "Last 7 days" },
  { key: "last30d", label: "Last 30 days" },
  { key: "MTD", label: "Month to date" },
  { key: "QTD", label: "Quarter to date" },
  { key: "YTD", label: "Year to date" },
];

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const active = PRESETS.find((p) => p.key === value.preset) ?? PRESETS[2];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex items-center gap-2 px-3 h-9 rounded-fp border border-fp-border-1 bg-fp-bg-1 text-sm text-fp-text-1 hover:bg-fp-bg-2">
        <span className="text-fp-text-3">📅</span>
        {active?.label}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-1 shadow-lg"
          align="end"
        >
          {PRESETS.map((p) => (
            <DropdownMenu.Item
              key={p.key}
              className={cn(
                "px-3 py-1.5 text-sm rounded hover:bg-fp-bg-2 cursor-pointer",
                p.key === value.preset && "bg-fp-bg-2",
              )}
              onSelect={() => onChange({ preset: p.key })}
            >
              {p.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
