import type {
  NumericFormat,
  ResolvedAdminConfig,
  ResolvedFormatting,
  TrackerCellResult,
  TrackerWidget,
  WidgetContext,
} from "@flowpanel/core";
import { formatLabel, formatNumber, resolveFormatting } from "@flowpanel/core";
import { TrackerCard, type TrackerCardRow } from "@flowpanel/react";
import type { ReactNode } from "react";
import { withFilterHrefs } from "./dashboard-filters";
import { filteredEmptyState } from "./filtered-empty";
import { resolveLink } from "./resolve-link";
import { type TrackerWindow, trackerRows, trackerWindow, worstTone } from "./tracker-rows";
import { type CaptionPromise, NO_CAPTION } from "./widget-caption";
import { rangedContext, requestNow } from "./widget-context";

function printValue(
  value: number | null,
  format: NumericFormat | undefined,
  formatting: ResolvedFormatting,
): string {
  return value === null ? "—" : formatNumber(value, format, formatting);
}

function blockTitle(
  cell: TrackerCellResult,
  window: TrackerWindow,
  format: NumericFormat | undefined,
  ctx: WidgetContext,
  formatting: ResolvedFormatting,
): string {
  const when =
    window.grain === "hour" ? ctx.format.dateTime(cell.start) : ctx.format.date(cell.start);
  const seen = formatLabel(ctx.labels.widget.observations, { n: ctx.format.number(cell.volume) });
  return `${when} · ${printValue(cell.value, format, formatting)} · ${seen}`;
}

async function foldedRows(
  widget: TrackerWidget,
  ctx: WidgetContext,
  window: TrackerWindow,
  config: ResolvedAdminConfig,
): Promise<TrackerCardRow[]> {
  const options = widget.options;
  const raw = options.query ? await options.query(ctx) : [];
  const formatting = resolveFormatting(config.formatting);
  return Promise.all(
    trackerRows(raw, options, window).map(async (row) => {
      const summary = options.summary ? await options.summary(row, ctx) : undefined;
      const href = options.rowHref
        ? resolveLink(config, ctx, options.rowHref(row.key, ctx))
        : undefined;
      return {
        key: row.key,
        label: row.label,
        tone: row.tone,
        cells: row.cells.map((cell) => ({
          tone: cell.tone,
          title: blockTitle(cell, window, options.format, ctx, formatting),
        })),
        ...(summary ? { summary } : {}),
        ...(href ? { href } : {}),
      };
    }),
  );
}

async function handRows(
  widget: TrackerWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
): Promise<TrackerCardRow[]> {
  const built = widget.options.rows ? await widget.options.rows(ctx) : [];
  return built.map((row) => {
    const href = resolveLink(config, ctx, row.href);
    return {
      key: row.key,
      label: row.label,
      tone: row.tone ?? worstTone(row.cells),
      cells: row.cells.map((cell, index) => ({
        tone: cell.tone,
        title: cell.title ?? `${row.label} ${index + 1}/${row.cells.length}`,
      })),
      ...(row.summary ? { summary: row.summary } : {}),
      ...(href ? { href } : {}),
    };
  });
}

/** A `tracker()` card: its window ending now, one row per key, one block per hour or day. */
export async function renderTracker(
  widget: TrackerWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  caption: CaptionPromise = NO_CAPTION,
): Promise<ReactNode> {
  const window = trackerWindow(widget.options.window, requestNow(ctx), ctx.dateRange.timeZone);
  const windowCtx = rangedContext(ctx, { from: window.from, to: window.to, preset: "custom" });
  const rows = widget.options.rows
    ? await handRows(widget, windowCtx, config)
    : await foldedRows(widget, windowCtx, window, config);
  const captionLine = await caption;
  return (
    <TrackerCard
      {...(widget.options.label ? { label: widget.options.label } : {})}
      rows={withFilterHrefs(ctx, widget.options.filter, rows, (row) => row.key)}
      emptyState={filteredEmptyState(ctx) ?? widget.options.emptyState ?? ctx.labels.widget.empty}
      {...(captionLine ? { caption: captionLine } : {})}
    />
  );
}
