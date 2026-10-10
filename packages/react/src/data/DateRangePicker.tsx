"use client";
import type { DateRangePreset } from "@flowpanel/core";
import { formatDayValue } from "@flowpanel/core/format";
import { DATE_RANGE_PRESETS } from "@flowpanel/core/internal";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Calendar } from "lucide-react";
import { cn } from "../lib/cn";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";

export interface DateRangePickerProps {
  value: { preset?: DateRangePreset; from?: Date; to?: Date };
  onChange: (next: { preset?: DateRangePreset; from?: Date; to?: Date }) => void;
  /** Presets to offer, in order. Default: all seven. */
  presets?: readonly DateRangePreset[];
}

export function DateRangePicker({
  value,
  onChange,
  presets = DATE_RANGE_PRESETS,
}: DateRangePickerProps) {
  const { dateRange } = useLabels();
  const formatting = useFormatting();
  const offered = presets.length > 0 ? presets : DATE_RANGE_PRESETS;
  const custom =
    !value.preset && value.from && value.to
      ? `${formatDayValue(value.from, formatting)} – ${formatDayValue(value.to, formatting)}`
      : null;
  const active =
    offered.find((key) => key === value.preset) ??
    (offered.includes("last7d") ? "last7d" : offered[0]);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="fp-inline-flex fp-h-11 fp-items-center fp-gap-2 fp-rounded fp-border fp-border-line fp-bg-surface fp-px-3 fp-text-sm fp-text-ink hover:fp-bg-canvas sm:fp-h-9">
        <Calendar className="fp-h-3.5 fp-w-3.5 fp-text-faint" aria-hidden />
        {custom ?? (active ? dateRange[active] : null)}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          data-flowpanel-portal=""
          className="fp-min-w-44 fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-1 fp-shadow-md"
          align="end"
        >
          {offered.map((key) => (
            <DropdownMenu.Item
              key={key}
              className={cn(
                "fp-flex fp-min-h-11 fp-cursor-pointer fp-items-center fp-rounded-[0.25rem] fp-px-3 fp-py-1.5 fp-text-sm fp-outline-none hover:fp-bg-canvas focus:fp-bg-canvas sm:fp-min-h-9",
                key === value.preset && "fp-bg-canvas",
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
