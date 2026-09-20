import type {
  BarRow,
  ColumnFormat,
  FunnelStep,
  KvItem,
  ListRow,
  MetricResult,
  NumericFormat,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedFormatting,
  StatResult,
  StatValue,
  StatWidget,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { formatColumnValue, formatNumber, resolveFormatting } from "@flowpanel/core";
import {
  BarsCard,
  FunnelCard,
  KvCard,
  ListCard,
  MetricCard,
  RealtimeRefresh,
  StatCard,
  StatGroupCard,
} from "@flowpanel/react";
import { type ComponentType, createElement, Fragment, type ReactNode } from "react";
import { ServerCard } from "./_server-card";
import { renderTableWidget } from "./render-table-widget";
import { statDisplay, statResultOf } from "./stat-result";

function isMetricResult(value: number | string | MetricResult): value is MetricResult {
  return typeof value === "object" && value !== null;
}

async function resolveStat(value: StatWidget["value"], ctx: WidgetContext): Promise<StatResult> {
  return statResultOf(typeof value === "function" ? await value(ctx) : value);
}

async function resolveStatValue(
  value: StatValue | ((ctx: WidgetContext) => Promise<StatValue>),
  ctx: WidgetContext,
): Promise<StatValue> {
  return typeof value === "function" ? await value(ctx) : value;
}

/** A `kv` item may name a column format or a numeric one; both resolve to a string here. */
function kvDisplay(
  value: StatValue,
  format: ColumnFormat | NumericFormat | undefined,
  formatting: ResolvedFormatting,
): string {
  if (value === null || value === undefined) return "—";
  if (format === undefined) return String(value);
  if (
    format === "currency" ||
    format === "percent" ||
    format === "bytes" ||
    format === "duration"
  ) {
    return typeof value === "number" ? formatNumber(value, format, formatting) : String(value);
  }
  return formatColumnValue(value, format, formatting);
}

function withRealtime(node: ReactNode, channels: string | string[] | undefined): ReactNode {
  return (
    <Fragment>
      {node}
      {channels ? <RealtimeRefresh channels={channels} /> : null}
    </Fragment>
  );
}

/** Render a widget on the server. */
export async function renderWidget(
  widget: WidgetConfig,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
): Promise<ReactNode> {
  switch (widget.kind) {
    case "metric": {
      const [produced, queriedDelta] = await Promise.all([
        widget.query(ctx),
        widget.options.delta ? widget.options.delta(ctx) : Promise.resolve(null),
      ]);
      const result = isMetricResult(produced) ? produced : { value: produced };
      const sparkline = widget.options.sparkline ? await widget.options.sparkline(ctx) : undefined;
      const delta = result.delta ?? queriedDelta;
      const sublabel = result.sublabel ?? widget.options.sublabel;
      const tone = result.tone ?? widget.options.tone;
      const drilldown = result.href ?? widget.options.drilldown;
      return withRealtime(
        <MetricCard
          label={widget.label}
          value={result.value}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          {...(sublabel ? { sublabel } : {})}
          delta={delta}
          {...(sparkline ? { sparkline } : {})}
          {...(tone ? { tone } : {})}
          {...(drilldown ? { drilldown } : {})}
          {...(widget.options.icon ? { icon: widget.options.icon } : {})}
        />,
        widget.options.realtime,
      );
    }
    case "statGroup": {
      const stats = await Promise.all(
        widget.options.stats.map(async (s) => ({
          label: s.label,
          value: await resolveStatValue(s.value, ctx),
          ...(s.format ? { format: s.format } : {}),
          ...(s.tone ? { tone: s.tone } : {}),
        })),
      );
      return withRealtime(
        <StatGroupCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          stats={stats}
        />,
        widget.options.realtime,
      );
    }
    case "stat": {
      const result = await resolveStat(widget.value, ctx);
      const hint = result.hint ?? widget.options.hint;
      const href = result.href ?? widget.options.href;
      const tone = result.tone ?? widget.options.tone;
      return withRealtime(
        <StatCard
          label={widget.label}
          value={statDisplay(result.value)}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          {...(hint ? { hint } : {})}
          {...(href ? { href } : {})}
          {...(tone ? { tone } : {})}
        />,
        widget.options.realtime,
      );
    }
    case "kv": {
      const formatting = resolveFormatting(config.formatting);
      const items = await Promise.all(
        widget.options.items.map(async (item: KvItem) => ({
          label: item.label,
          value: kvDisplay(await resolveStatValue(item.value, ctx), item.format, formatting),
          ...(item.tone ? { tone: item.tone } : {}),
          ...(item.href ? { href: item.href } : {}),
        })),
      );
      return withRealtime(
        <KvCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          items={items}
          {...(widget.options.columns ? { columns: widget.options.columns } : {})}
        />,
        widget.options.realtime,
      );
    }
    case "bars": {
      const rows: BarRow[] = await widget.options.query(ctx);
      return withRealtime(
        <BarsCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          rows={rows}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          emptyState={widget.options.emptyState ?? ctx.labels.widget.empty}
        />,
        widget.options.realtime,
      );
    }
    case "funnel": {
      const steps: FunnelStep[] = await widget.options.query(ctx);
      return withRealtime(
        <FunnelCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          steps={steps}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          emptyState={widget.options.emptyState ?? ctx.labels.widget.empty}
        />,
        widget.options.realtime,
      );
    }
    case "list": {
      const rows: ListRow[] = await widget.options.query(ctx);
      return withRealtime(
        <ListCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          rows={rows}
          emptyState={widget.options.emptyState ?? ctx.labels.widget.empty}
        />,
        widget.options.realtime,
      );
    }
    case "custom": {
      const props =
        typeof widget.props === "function"
          ? await (widget.props as (c: WidgetContext) => Promise<unknown>)(ctx)
          : widget.props;
      const Component = widget.Component as ComponentType<unknown>;
      const inner = createElement(Component, props as Record<string, unknown>);
      const framed = widget.options.frame === false ? inner : <ServerCard>{inner}</ServerCard>;
      return withRealtime(framed, widget.options.realtime);
    }
    case "table":
      return renderTableWidget(widget, ctx, config, reqCtx);
    case "areaChart":
    case "barChart":
    case "lineChart":
    case "pieChart": {
      let chartsMod: {
        // biome-ignore lint/suspicious/noExplicitAny: cross-package dynamic import
        ChartRenderer: (props: any) => ReactNode;
      };
      try {
        chartsMod =
          // biome-ignore lint/suspicious/noExplicitAny: dynamic import surface not typed
          (await import("@flowpanel/charts/runtime" as any)) as any;
      } catch (e) {
        console.error("[flowpanel/charts] dynamic import failed:", e);
        return (
          <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-4 text-xs text-fp-text-3">
            {ctx.labels.widget.chartsMissing}
          </div>
        );
      }
      const data = await widget.query(ctx);
      const Renderer = chartsMod.ChartRenderer;
      return withRealtime(
        <Renderer kind={widget.kind} label={widget.label} options={widget.options} data={data} />,
        widget.options.realtime,
      );
    }
  }
}
