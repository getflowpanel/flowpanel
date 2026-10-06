import {
  formatLabel,
  type HeatmapSource,
  type HeatmapWidget,
  type RequestContext,
  type ResolvedAdminConfig,
  resolveFormatting,
  type WidgetContext,
} from "@flowpanel/core";
import { toDateValue } from "@flowpanel/core/format";
import {
  dayKeyIn,
  dayStartIn,
  heatmapGrid,
  shiftDayKey,
  weekStartOf,
} from "@flowpanel/core/internal";
import { HeatmapCard, type HeatmapCardCell } from "@flowpanel/react";
import type { ReactNode } from "react";
import { filteredEmptyState } from "./filtered-empty";
import { scopeToRecord } from "./record-scope";
import { resolveLink } from "./resolve-link";
import { type CaptionPromise, NO_CAPTION } from "./widget-caption";
import { requestNow } from "./widget-context";
import { authorizedRead } from "./widget-reads";

export const HEATMAP_ROW_CAP = 10_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Point = { at: Date | string; value: number };

function pointOf(at: unknown, value: unknown): Point | null {
  if (typeof at === "string" && DAY.test(at)) return { at, value: Number(value) };
  const moment = toDateValue(at);
  return moment ? { at: moment, value: Number(value) } : null;
}

async function sourcePoints(
  source: HeatmapSource,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  since: Date,
): Promise<Point[]> {
  const own = (
    typeof source.where === "function" ? source.where(ctx) : (source.where ?? {})
  ) as Record<string, unknown>;
  const site = `heatmap source ("${source.resource}")`;
  const where = {
    ...scopeToRecord(config, ctx, source.resource, own, site, true, source.by),
    [source.at]: { gte: since },
  };
  const fields = [source.at, ...(source.value ? [source.value] : [])];
  const rows = await authorizedRead(
    config,
    reqCtx,
    ctx.dateRange,
    source.resource,
    { where, limit: HEATMAP_ROW_CAP + 1, fields },
    HEATMAP_ROW_CAP + 1,
  );
  if (rows.length > HEATMAP_ROW_CAP) {
    throw new Error(
      `flowpanel: heatmap reads more than 10,000 rows of "${source.resource}"; total them per day in SQL and pass query instead.`,
    );
  }
  return rows.flatMap((row) => pointOf(row[source.at], source.value ? row[source.value] : 1) ?? []);
}

function weekdayLabels(locale: string, weekStart: number) {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return [0, 2, 4].map((row) => ({
    row,
    label: format.format(new Date(Date.UTC(2024, 0, ((weekStart - 1 + row) % 7) + 1))),
  }));
}

function monthLabels(weeks: Array<Array<{ day: string } | null>>, locale: string) {
  const format = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  let last = "";
  return weeks.flatMap((week, index) => {
    const day = week.find((cell) => cell !== null)?.day;
    if (!day || day.slice(0, 7) === last) return [];
    last = day.slice(0, 7);
    return [{ index, label: format.format(new Date(`${day}T00:00:00Z`)) }];
  });
}

/** A `heatmap()` card: the last `days` days, bucketed in the admin's zone, as weeks of cells. */
export async function renderHeatmap(
  widget: HeatmapWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  caption: CaptionPromise = NO_CAPTION,
): Promise<ReactNode> {
  const options = widget.options;
  const { locale } = resolveFormatting(config.formatting);
  const zone = ctx.dateRange.timeZone;
  const days = Math.min(Math.max(Math.trunc(options.days ?? 91), 7), 371);
  const today = dayKeyIn(new Date(requestNow(ctx)), zone);
  const first = shiftDayKey(today, -(days - 1));
  const [points, captionLine] = await Promise.all([
    options.query
      ? options.query(ctx).then((rows) => rows.flatMap((p) => pointOf(p.at, p.value) ?? []))
      : options.source
        ? sourcePoints(options.source, ctx, config, reqCtx, dayStartIn(first, zone))
        : [],
    caption,
  ]);
  const weekStart = weekStartOf(locale);
  const grid = heatmapGrid(points, today, days, zone, weekStart);
  const filtered = filteredEmptyState(ctx);
  const amount = (n: number) =>
    options.unit ? ctx.format.plural(n, options.unit) : ctx.format.number(n);
  const weeks = grid.weeks.map((week) =>
    week.map((cell): HeatmapCardCell | null => {
      if (!cell) return null;
      const link = options.href?.(
        {
          from: dayStartIn(cell.day, zone),
          to: new Date(dayStartIn(shiftDayKey(cell.day, 1), zone).getTime() - 1),
        },
        ctx,
      );
      const href = link ? resolveLink(config, ctx, link) : undefined;
      return {
        key: cell.day,
        level: cell.level,
        title: formatLabel(ctx.labels.heatmap.cell, {
          date: ctx.format.date(cell.day),
          value: amount(cell.value),
        }),
        ...(href ? { href } : {}),
      };
    }),
  );
  return (
    <HeatmapCard
      {...(options.label ? { label: options.label } : {})}
      summary={formatLabel(ctx.labels.heatmap.summary, {
        total: amount(grid.total),
        days: ctx.format.number(days),
      })}
      weeks={weeks}
      months={monthLabels(grid.weeks, locale)}
      weekdays={weekdayLabels(locale, weekStart)}
      {...(options.tone ? { tone: options.tone } : {})}
      legend={{ less: ctx.labels.heatmap.less, more: ctx.labels.heatmap.more }}
      {...(grid.total === 0 && (filtered ?? options.emptyState) !== undefined
        ? { emptyState: filtered ?? options.emptyState }
        : {})}
      {...(captionLine ? { caption: captionLine } : {})}
    />
  );
}
