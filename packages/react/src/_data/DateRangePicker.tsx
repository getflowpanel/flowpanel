"use client";
import type { DateRangePreset } from "@flowpanel/core";
import { formatDayValue } from "@flowpanel/core/format";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Calendar } from "lucide-react";
import { useFormatting } from "../_provider/FormattingContext";
import { useLabels } from "../_provider/LabelsContext";
import { cn } from "../lib/cn";

export interface DateRangePickerProps {
  value: { preset?: DateRangePreset; from?: Date; to?: Date };
  onChange: (next: { preset?: DateRangePreset; from?: Date; to?: Date }) => void;
  /** Presets to offer, in order. Default: all seven. */
  presets?: readonly DateRangePreset[];
}

const ALL_PRESETS: readonly DateRangePreset[] = [
  "today",
  "yesterday",
  "last7d",
  "last30d",
  "MTD",
  "QTD",
  "YTD",
];

export function DateRangePicker({ value, onChange, presets = ALL_PRESETS }: DateRangePickerProps) {
  const { dateRange } = useLabels();
  const formatting = useFormatting();
  const offered = presets.length > 0 ? presets : ALL_PRESETS;
  const custom =
    !value.preset && value.from && value.to
      ? `${formatDayValue(value.from, formatting)} – ${formatDayValue(value.to, formatting)}`
      : null;
  const active =
    offered.find((key) => key === value.preset) ??
    (offered.includes("last7d") ? "last7d" : offered[0]);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex h-11 items-center gap-2 rounded-fp border border-fp-border-1 bg-fp-bg-1 px-3 text-sm text-fp-text-1 hover:bg-fp-bg-2 sm:h-9">
        <Calendar className="h-3.5 w-3.5 text-fp-text-3" aria-hidden />
        {custom ?? (active ? dateRange[active] : null)}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          data-flowpanel-portal=""
          className="min-w-44 rounded-fp-lg border border-fp-border-1 bg-fp-bg-1 p-1 shadow-fp-md"
          align="end"
        >
          {offered.map((key) => (
            <DropdownMenu.Item
              key={key}
              className={cn(
                "flex min-h-11 cursor-pointer items-center rounded px-3 py-1.5 text-sm outline-none hover:bg-fp-bg-2 focus:bg-fp-bg-2 sm:min-h-9",
                key === value.preset && "bg-fp-bg-2",
              )}
              onSelect={() => onChange({ preset: key })}
            >
              {dateRange[key]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
