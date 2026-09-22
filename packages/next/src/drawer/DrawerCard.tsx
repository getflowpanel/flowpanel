"use client";
import { BarsCard, FunnelCard, KvCard, ListCard, StatCard, type Tone } from "@flowpanel/react";
import type { ReactNode } from "react";
import type { SerializedCardWidget } from "./serialize-cards";
import type { SerializedWidget } from "./serialize-widget";

/** The dashboard's own card components, driven by the drawer's serialized payload. */
export function DrawerCard({ widget }: { widget: SerializedCardWidget }): ReactNode {
  switch (widget.kind) {
    case "stat":
      return (
        <StatCard
          label={widget.label}
          value={widget.value}
          {...(widget.format ? { format: widget.format } : {})}
          {...(widget.hint ? { hint: widget.hint } : {})}
          {...(widget.href ? { href: widget.href } : {})}
          {...(widget.tone ? { tone: widget.tone as Tone } : {})}
        />
      );
    case "kv":
      return (
        <KvCard
          {...(widget.label ? { label: widget.label } : {})}
          items={widget.items.map(({ tone, ...item }) => ({
            ...item,
            ...(tone ? { tone: tone as Tone } : {}),
          }))}
          {...(widget.columns ? { columns: widget.columns } : {})}
        />
      );
    case "bars":
      return (
        <BarsCard
          {...(widget.label ? { label: widget.label } : {})}
          rows={widget.rows}
          {...(widget.format ? { format: widget.format } : {})}
          emptyState={widget.emptyState}
        />
      );
    case "funnel":
      return (
        <FunnelCard
          {...(widget.label ? { label: widget.label } : {})}
          steps={widget.steps}
          {...(widget.format ? { format: widget.format } : {})}
          emptyState={widget.emptyState}
        />
      );
    case "list":
      return (
        <ListCard
          {...(widget.label ? { label: widget.label } : {})}
          rows={widget.rows}
          emptyState={widget.emptyState}
        />
      );
  }
}

/** A `Record` over the union's own kinds, so a new card kind fails to compile here. */
const CARD_KINDS: Record<SerializedCardWidget["kind"], true> = {
  stat: true,
  kv: true,
  bars: true,
  funnel: true,
  list: true,
};

export function isCardWidget(widget: SerializedWidget): widget is SerializedCardWidget {
  return widget.kind in CARD_KINDS;
}
