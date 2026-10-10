"use client";
import { formatLabel } from "@flowpanel/core/labels";
import {
  MetricCard,
  type NumericFormat,
  RealtimeRefresh,
  type Tone,
  useLabels,
} from "@flowpanel/react";
import { Fragment, type ReactNode } from "react";
import { DrawerCard, isCardWidget } from "./DrawerCard";
import { DrawerStatGroup } from "./DrawerStatGroup";
import { DrawerTableWidget } from "./DrawerTableWidget";
import type { SerializedDrawerTab, SerializedWidget } from "./drawer-payload";

function NoteCard({
  label,
  children,
  failed,
}: {
  label?: string;
  children: ReactNode;
  failed?: boolean;
}) {
  return (
    <div
      {...(failed ? { "data-fp-error": "" } : {})}
      className="fp-rounded fp-border fp-border-line fp-bg-canvas fp-p-4 fp-text-sm fp-text-faint md:fp-col-span-2"
    >
      {label ? <div className="fp-font-medium fp-text-soft">{label}</div> : null}
      <div className={label ? "fp-mt-1 fp-text-xs" : undefined}>{children}</div>
    </div>
  );
}

function WidgetView({ widget }: { widget: SerializedWidget }) {
  const labels = useLabels();
  if (widget.kind === "metric") {
    return (
      <MetricCard
        label={widget.label}
        value={widget.value}
        {...(widget.format ? { format: widget.format as NumericFormat } : {})}
        {...(widget.sublabel ? { sublabel: widget.sublabel } : {})}
        {...(widget.tone ? { tone: widget.tone as Tone } : {})}
      />
    );
  }
  if (widget.kind === "table") return <DrawerTableWidget widget={widget} />;
  if (widget.kind === "statGroup") return <DrawerStatGroup widget={widget} />;
  if (isCardWidget(widget)) return <DrawerCard widget={widget} />;
  if (widget.kind === "chart") {
    return (
      <NoteCard label={widget.label}>
        {formatLabel(labels.drawer.chartElsewhere, { n: widget.dataPoints })}
      </NoteCard>
    );
  }
  if (widget.failed) {
    return (
      <NoteCard label={widget.label ?? labels.errors.widgetTitle} failed>
        {widget.label ? `${labels.errors.widgetTitle}. ${widget.reason}` : widget.reason}
      </NoteCard>
    );
  }
  return <NoteCard {...(widget.label ? { label: widget.label } : {})}>{widget.reason}</NoteCard>;
}

/** A widgets tab: each widget as its dashboard card, two to a row from `md`. */
export function DrawerWidgetsTab({
  tab,
}: {
  tab: Extract<SerializedDrawerTab, { kind: "widgets" }>;
}) {
  const labels = useLabels();
  if (tab.widgets.length === 0) {
    return <div className="fp-py-6 fp-text-sm fp-text-faint">{labels.drawer.noWidgets}</div>;
  }
  return (
    <div className="fp-grid fp-grid-cols-1 fp-gap-3 md:fp-grid-cols-2">
      {tab.widgets.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a tab's widgets keep their declared order.
        <Fragment key={index}>
          <WidgetView widget={item} />
          {"realtime" in item && item.realtime ? (
            <RealtimeRefresh channels={item.realtime} />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
