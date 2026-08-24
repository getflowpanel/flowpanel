"use client";
import type { DateRangePreset } from "@flowpanel/core";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Calendar } from "lucide-react";
import { cn } from "../lib/cn.js";

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
      <DropdownMenu.Trigger className="inline-flex h-11 items-center gap-2 rounded-fp border border-fp-border-1 bg-fp-bg-1 px-3 text-sm text-fp-text-1 hover:bg-fp-bg-2 sm:h-9">
        <Calendar className="h-3.5 w-3.5 text-fp-text-3" aria-hidden />
        {active?.label}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          data-flowpanel-portal=""
          className="min-w-44 rounded-fp-lg border border-fp-border-1 bg-fp-bg-1 p-1 shadow-fp-md"
          align="end"
        >
          {PRESETS.map((p) => (
            <DropdownMenu.Item
              key={p.key}
              className={cn(
                "flex min-h-11 cursor-pointer items-center rounded px-3 py-1.5 text-sm outline-none hover:bg-fp-bg-2 focus:bg-fp-bg-2 sm:min-h-9",
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
