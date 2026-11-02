"use client";
import { type NumericFormat, StatGroupCard, type Tone } from "@flowpanel/react";
import type { SerializedWidget } from "./drawer-payload";

/** A `statGroup()` widget across the drawer's full width. */
export function DrawerStatGroup({
  widget,
}: {
  widget: Extract<SerializedWidget, { kind: "statGroup" }>;
}) {
  return (
    <div className="md:fp-col-span-2">
      <StatGroupCard
        {...(widget.label ? { label: widget.label } : {})}
        stats={widget.stats.map(({ format, tone, ...stat }) => ({
          ...stat,
          ...(format ? { format: format as NumericFormat } : {}),
          ...(tone ? { tone: tone as Tone } : {}),
        }))}
      />
    </div>
  );
}
